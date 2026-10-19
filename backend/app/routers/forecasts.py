"""
Demand Forecasts REST Router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pymongo.database import Database
from app.db.connection import get_db
from app.models.schemas import (
    ForecastOut,
    ForecastTriggerRequest
)
from app.services.forecasting_service import ForecastingService

router = APIRouter(prefix="/api/forecasts", tags=["Demand Forecasting"])


@router.post("/trigger", response_model=List[ForecastOut])
def trigger_forecast(payload: ForecastTriggerRequest, db: Database = Depends(get_db)):
    """
    Triggers model training and forward demand forecasting:
    - Extracts daily sales series with zero-filling for missing dates.
    - Generates lag and temporal features.
    - Evaluates Random Forest against baseline on a time-aware holdout test split.
    - Calculates real MAE, RMSE, and MAPE metrics.
    - Recursively forecasts demand over the specified horizon.
    - Transparently falls back to baseline with explicit explanation if history < 14 days.
    """
    try:
        return ForecastingService.trigger_bulk_forecasts(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Forecasting engine error: {str(e)}"
        )


@router.get("/latest/{product_id}", response_model=ForecastOut)
def get_latest_product_forecast(product_id: str, db: Database = Depends(get_db)):
    """
    Retrieve the most recent demand forecast generated for a product.
    If no forecast exists yet, triggers an initial forecast calculation on the fly.
    """
    forecast = ForecastingService.get_latest_forecast(db, product_id)
    if not forecast:
        try:
            return ForecastingService.generate_forecast(db, product_id, horizon_days=14)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return forecast


@router.get("/all", response_model=List[ForecastOut])
def list_all_latest_forecasts(db: Database = Depends(get_db)):
    """
    Returns latest forecast records across all products.
    """
    pipeline = [
        {"$sort": {"generated_at": -1}},
        {
            "$group": {
                "_id": "$product_id",
                "latest_doc": {"$first": "$$ROOT"}
            }
        },
        {"$replaceRoot": {"newRoot": "$latest_doc"}}
    ]
    cursor = db.forecasts.aggregate(pipeline)
    return [ForecastingService._doc_to_model(doc) for doc in cursor]
