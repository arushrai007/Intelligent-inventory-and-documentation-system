"""
Demand Forecasting Service
Implements machine learning demand forecasting using scikit-learn, PyMongo, pandas, and NumPy.
Includes zero-filling, feature engineering, time-aware train/test validation,
baseline comparison (MAE, RMSE, MAPE), and fallback detection for sparse datasets.
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from pymongo.database import Database
from pymongo import DESCENDING

from app.models.schemas import (
    ForecastOut,
    DailyPrediction,
    ModelEvaluationMetrics,
    ForecastTriggerRequest
)

logger = logging.getLogger("inventory_system.forecasting")


class ForecastingService:
    MODEL_NAME = "RandomForestRegressor"
    MODEL_VERSION = "rf-v1.2.0"
    MIN_REQUIRED_DAYS = 14

    @classmethod
    def get_product_daily_series(cls, db: Database, product_id: ObjectId) -> pd.DataFrame:
        """
        Pulls raw transactions from MongoDB for a product, aggregates daily totals,
        and ensures complete continuous daily series with zero-filling for days without sales.
        """
        cursor = db.sales.find(
            {"product_id": product_id},
            {"sale_date": 1, "quantity": 1, "_id": 0}
        ).sort("sale_date", 1)

        records = list(cursor)
        if not records:
            return pd.DataFrame()

        df = pd.DataFrame(records)
        df["sale_date"] = pd.to_datetime(df["sale_date"])
        # Standardize to naive UTC date for daily aggregation
        df["date"] = df["sale_date"].dt.date

        # Daily sum of quantity sold
        daily = df.groupby("date")["quantity"].sum().reset_index()
        daily["date"] = pd.to_datetime(daily["date"])
        daily.set_index("date", inplace=True)

        # Generate continuous date range to properly capture zero-demand days
        full_idx = pd.date_range(start=daily.index.min(), end=daily.index.max(), freq="D")
        daily = daily.reindex(full_idx, fill_value=0)
        daily.index.name = "date"
        daily.reset_index(inplace=True)
        daily.rename(columns={"index": "date"}, inplace=True)

        return daily

    @classmethod
    def create_features(cls, df: pd.DataFrame) -> pd.DataFrame:
        """
        Extracts temporal and lagged features:
        - lag_1, lag_7, lag_14
        - 7-day and 14-day rolling averages
        - day_of_week and weekend indicator
        """
        data = df.copy()
        data["lag_1"] = data["quantity"].shift(1)
        data["lag_7"] = data["quantity"].shift(7)
        data["lag_14"] = data["quantity"].shift(14)
        data["rolling_mean_7"] = data["quantity"].shift(1).rolling(window=7, min_periods=1).mean()
        data["rolling_std_7"] = data["quantity"].shift(1).rolling(window=7, min_periods=1).std().fillna(0)
        data["rolling_mean_14"] = data["quantity"].shift(1).rolling(window=14, min_periods=1).mean()
        data["day_of_week"] = data["date"].dt.dayofweek
        data["is_weekend"] = data["day_of_week"].isin([4, 5, 6]).astype(int)
        return data

    @classmethod
    def generate_forecast(
        cls,
        db: Database,
        product_id_str: str,
        horizon_days: int = 14
    ) -> ForecastOut:
        try:
            prod_obj_id = ObjectId(product_id_str)
        except Exception:
            prod_obj_id = product_id_str

        product = db.products.find_one({"_id": prod_obj_id})
        if not product:
            raise ValueError(f"Product not found with ID: {product_id_str}")

        now = datetime.now(timezone.utc)
        daily_df = cls.get_product_daily_series(db, product["_id"])
        data_points_count = len(daily_df)

        # -------------------------------------------------------------
        # Case A: Insufficient Historical Data (< MIN_REQUIRED_DAYS)
        # Transparent fallback to baseline moving average with explicit reason
        # -------------------------------------------------------------
        if data_points_count < cls.MIN_REQUIRED_DAYS:
            logger.info(
                f"Sparse data for {product['sku']} ({data_points_count} points). "
                f"Falling back to simple baseline."
            )
            recent_mean = float(daily_df["quantity"].mean()) if data_points_count > 0 else 5.0
            predictions = []

            for i in range(1, horizon_days + 1):
                f_date = (now + timedelta(days=i)).strftime("%Y-%m-%d")
                predictions.append(
                    DailyPrediction(
                        date=f_date,
                        predicted_demand=round(recent_mean, 2),
                        lower_bound=round(max(0.0, recent_mean * 0.7), 2),
                        upper_bound=round(recent_mean * 1.3, 2)
                    )
                )

            metrics = ModelEvaluationMetrics(
                mae=0.0,
                rmse=0.0,
                mape=0.0,
                baseline_mae=0.0,
                baseline_rmse=0.0,
                comparison_verdict="Historical data insufficient for machine learning validation. Baseline heuristic applied."
            )

            forecast_doc = {
                "product_id": product["_id"],
                "sku": product["sku"],
                "product_name": product["name"],
                "model_name": "MovingAverageBaseline",
                "model_version": "baseline-heuristic-v1",
                "forecast_horizon_days": horizon_days,
                "generated_at": now,
                "evaluation_metrics": metrics.model_dump(),
                "is_fallback": True,
                "fallback_reason": f"Insufficient historical sales data: Product has {data_points_count} daily observations, which is below the minimum requirement of {cls.MIN_REQUIRED_DAYS} days.",
                "historical_points_used": data_points_count,
                "predictions": [p.model_dump() for p in predictions]
            }

            res = db.forecasts.insert_one(forecast_doc)
            forecast_doc["_id"] = res.inserted_id
            return cls._doc_to_model(forecast_doc)

        # -------------------------------------------------------------
        # Case B: Sufficient Historical Data -> Train & Validate ML Model
        # -------------------------------------------------------------
        featured_df = cls.create_features(daily_df)
        clean_df = featured_df.dropna().reset_index(drop=True)

        feature_cols = [
            "lag_1", "lag_7", "lag_14",
            "rolling_mean_7", "rolling_std_7", "rolling_mean_14",
            "day_of_week", "is_weekend"
        ]

        # Time-aware split: 80% train, 20% test (preserving temporal order, NO random shuffle)
        split_idx = int(len(clean_df) * 0.8)
        train_data = clean_df.iloc[:split_idx]
        test_data = clean_df.iloc[split_idx:]

        X_train = train_data[feature_cols]
        y_train = train_data["quantity"]
        X_test = test_data[feature_cols]
        y_test = test_data["quantity"]

        # 1. Baseline Model (Naive 7-day Lag or 7-day Moving Average)
        y_baseline_pred = test_data["lag_7"].values
        base_mae = float(mean_absolute_error(y_test, y_baseline_pred))
        base_rmse = float(np.sqrt(mean_squared_error(y_test, y_baseline_pred)))

        # 2. Machine Learning Model: Random Forest Regressor
        rf_model = RandomForestRegressor(
            n_estimators=60,
            max_depth=6,
            min_samples_split=4,
            random_state=42
        )
        rf_model.fit(X_train, y_train)
        y_pred = rf_model.predict(X_test)

        ml_mae = float(mean_absolute_error(y_test, y_pred))
        ml_rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))

        # Safe MAPE calculation (avoid division by zero on zero-sales days)
        nonzero_mask = y_test > 0
        if np.any(nonzero_mask):
            mape = float(np.mean(np.abs((y_test[nonzero_mask] - y_pred[nonzero_mask]) / y_test[nonzero_mask])) * 100.0)
        else:
            mape = 0.0

        improvement = ((base_mae - ml_mae) / base_mae) * 100.0 if base_mae > 0 else 0.0
        verdict = (
            f"Random Forest achieved {round(improvement, 1)}% lower MAE compared to the naive 7-day lag baseline "
            f"(ML MAE: {round(ml_mae, 2)} vs. Baseline MAE: {round(base_mae, 2)})."
            if ml_mae <= base_mae
            else f"Baseline performed closely to ML model on recent window (ML MAE: {round(ml_mae, 2)} vs. Baseline MAE: {round(base_mae, 2)})."
        )

        metrics = ModelEvaluationMetrics(
            mae=round(ml_mae, 3),
            rmse=round(ml_rmse, 3),
            mape=round(mape, 2),
            baseline_mae=round(base_mae, 3),
            baseline_rmse=round(base_rmse, 3),
            comparison_verdict=verdict
        )

        # 3. Refit model on ALL historical data for forward forecasting
        full_X = clean_df[feature_cols]
        full_y = clean_df["quantity"]
        rf_model.fit(full_X, full_y)

        # Calculate prediction residual standard deviation for bounds
        residuals = full_y - rf_model.predict(full_X)
        std_residual = float(np.std(residuals)) if len(residuals) > 0 else 1.5

        # 4. Multi-step Recursive Out-of-Sample Forecasting
        history_series = clean_df["quantity"].tolist()
        last_date = clean_df["date"].max()
        future_predictions = []

        for step in range(1, horizon_days + 1):
            future_date = last_date + timedelta(days=step)
            dow = future_date.weekday()
            is_wknd = 1 if dow in [4, 5, 6] else 0

            # Construct feature row from history + simulated future
            lag1 = history_series[-1]
            lag7 = history_series[-7] if len(history_series) >= 7 else history_series[-1]
            lag14 = history_series[-14] if len(history_series) >= 14 else lag7
            roll7 = np.mean(history_series[-7:])
            roll_std = np.std(history_series[-7:]) if len(history_series) >= 7 else 0.0
            roll14 = np.mean(history_series[-14:]) if len(history_series) >= 14 else roll7

            feature_vector = pd.DataFrame([{
                "lag_1": lag1,
                "lag_7": lag7,
                "lag_14": lag14,
                "rolling_mean_7": roll7,
                "rolling_std_7": roll_std,
                "rolling_mean_14": roll14,
                "day_of_week": dow,
                "is_weekend": is_wknd
            }])

            pred_val = float(rf_model.predict(feature_vector)[0])
            pred_val = max(0.0, pred_val)

            # Store in history series for recursive multi-step forecasting
            history_series.append(pred_val)

            lower_bound = max(0.0, round(pred_val - (1.65 * std_residual), 2))
            upper_bound = round(pred_val + (1.65 * std_residual), 2)

            future_predictions.append(
                DailyPrediction(
                    date=future_date.strftime("%Y-%m-%d"),
                    predicted_demand=round(pred_val, 2),
                    lower_bound=lower_bound,
                    upper_bound=upper_bound
                )
            )

        # 5. Save Forecast Document into MongoDB
        forecast_doc = {
            "product_id": product["_id"],
            "sku": product["sku"],
            "product_name": product["name"],
            "model_name": cls.MODEL_NAME,
            "model_version": cls.MODEL_VERSION,
            "forecast_horizon_days": horizon_days,
            "generated_at": now,
            "evaluation_metrics": metrics.model_dump(),
            "is_fallback": False,
            "fallback_reason": None,
            "historical_points_used": len(clean_df),
            "predictions": [p.model_dump() for p in future_predictions]
        }

        res = db.forecasts.insert_one(forecast_doc)
        forecast_doc["_id"] = res.inserted_id
        return cls._doc_to_model(forecast_doc)

    @classmethod
    def get_latest_forecast(cls, db: Database, product_id_str: str) -> Optional[ForecastOut]:
        try:
            prod_obj_id = ObjectId(product_id_str)
            query = {"product_id": prod_obj_id}
        except Exception:
            query = {"product_id": product_id_str}

        doc = db.forecasts.find_one(query, sort=[("generated_at", DESCENDING)])
        if not doc:
            return None
        return cls._doc_to_model(doc)

    @classmethod
    def trigger_bulk_forecasts(cls, db: Database, payload: ForecastTriggerRequest) -> List[ForecastOut]:
        """
        Triggers forecasts for either a single specified product or all active products.
        """
        if payload.product_id:
            return [cls.generate_forecast(db, payload.product_id, payload.horizon_days)]

        results = []
        products = list(db.products.find({}, {"_id": 1}))
        for prod in products:
            try:
                res = cls.generate_forecast(db, str(prod["_id"]), payload.horizon_days)
                results.append(res)
            except Exception as e:
                logger.error(f"Failed to generate forecast for product {prod['_id']}: {e}")
        return results

    @staticmethod
    def _doc_to_model(doc: Dict[str, Any]) -> ForecastOut:
        predictions = [
            DailyPrediction(
                date=p["date"],
                predicted_demand=float(p["predicted_demand"]),
                lower_bound=float(p.get("lower_bound", 0.0)),
                upper_bound=float(p.get("upper_bound", 0.0))
            )
            for p in doc.get("predictions", [])
        ]

        metrics = None
        if doc.get("evaluation_metrics"):
            m = doc["evaluation_metrics"]
            metrics = ModelEvaluationMetrics(
                mae=float(m["mae"]),
                rmse=float(m["rmse"]),
                mape=float(m["mape"]),
                baseline_mae=float(m.get("baseline_mae", 0.0)),
                baseline_rmse=float(m.get("baseline_rmse", 0.0)),
                comparison_verdict=m.get("comparison_verdict")
            )

        return ForecastOut(
            id=str(doc["_id"]),
            product_id=str(doc["product_id"]),
            sku=doc.get("sku", "UNKNOWN"),
            product_name=doc.get("product_name"),
            model_name=doc.get("model_name", "RandomForestRegressor"),
            model_version=doc.get("model_version", "rf-v1.0.0"),
            forecast_horizon_days=int(doc.get("forecast_horizon_days", 14)),
            generated_at=doc["generated_at"],
            evaluation_metrics=metrics,
            is_fallback=bool(doc.get("is_fallback", False)),
            fallback_reason=doc.get("fallback_reason"),
            historical_points_used=int(doc.get("historical_points_used", 0)),
            predictions=predictions
        )
