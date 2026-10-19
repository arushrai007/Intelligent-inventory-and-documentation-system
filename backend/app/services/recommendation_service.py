"""
Reorder Recommendation Service
Calculates inventory replenishment recommendations based on documented supply-chain formulas:
- Reorder Point (ROP) = Lead Time Demand + Safety Stock
- Safety Stock (SS) = Z * sqrt(L * sigma_d^2 + d_bar^2 * sigma_L^2)
- Economic Order Quantity (EOQ) = sqrt((2 * D_annual * S) / H)
- Recommended Reorder Quantity (ROQ)
- Days until stockout estimation
"""

import math
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import numpy as np
from pymongo.database import Database

from app.models.schemas import (
    ReorderRecommendationOut,
    RecommendationUrgency,
    SystemSettings
)

logger = logging.getLogger("inventory_system.recommendations")


class RecommendationService:
    @classmethod
    def get_settings(cls, db: Database) -> Dict[str, Any]:
        """Loads system settings or defaults."""
        doc = db.system_settings.find_one({"key": "inventory_policy"})
        if not doc:
            return {
                "default_lead_time_days": 7,
                "safety_stock_z_score": 1.65,  # 95% service level
                "annual_holding_cost_rate": 0.20,
                "fixed_order_cost": 50.0
            }
        return doc

    @classmethod
    def generate_recommendations(
        cls,
        db: Database,
        urgency_filter: Optional[str] = None
    ) -> List[ReorderRecommendationOut]:
        """
        Generates actionable reorder recommendations for all products in the catalog.
        """
        settings = cls.get_settings(db)
        z_score = float(settings.get("safety_stock_z_score", 1.65))
        holding_rate = float(settings.get("annual_holding_cost_rate", 0.20))
        order_cost_fixed = float(settings.get("fixed_order_cost", 50.0))
        default_lead_time = int(settings.get("default_lead_time_days", 7))

        # Fetch all products with supplier information embedded
        pipeline = [
            {
                "$lookup": {
                    "from": "suppliers",
                    "let": {"sup_id": "$supplier_id"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$or": [
                                        {"$eq": ["$_id", "$$sup_id"]},
                                        {"$eq": [{"$toString": "$_id"}, "$$sup_id"]}
                                    ]
                                }
                            }
                        }
                    ],
                    "as": "supplier_docs"
                }
            },
            {
                "$addFields": {
                    "supplier_obj": {"$arrayElemAt": ["$supplier_docs", 0]}
                }
            }
        ]

        products = list(db.products.aggregate(pipeline))
        recommendations: List[ReorderRecommendationOut] = []
        now = datetime.now(timezone.utc)
        thirty_days_ago = now - timedelta(days=30)

        for prod in products:
            prod_id = prod["_id"]
            current_stock = int(prod.get("current_stock", 0))
            cost_price = float(prod.get("cost_price", 1.0))
            unit_cost = max(cost_price, 0.5)

            # 1. Supplier parameters
            sup = prod.get("supplier_obj") or {}
            lead_time = int(sup.get("lead_time_days", default_lead_time))
            lead_time_variance = float(sup.get("lead_time_variance_days", 1.0))

            # 2. Demand statistics from recent 30-day sales
            sales_cursor = db.sales.find({
                "product_id": prod_id,
                "sale_date": {"$gte": thirty_days_ago}
            }, {"quantity": 1, "sale_date": 1})
            sales_list = list(sales_cursor)

            if sales_list:
                daily_sums: Dict[str, int] = {}
                for s in sales_list:
                    d_str = s["sale_date"].strftime("%Y-%m-%d")
                    daily_sums[d_str] = daily_sums.get(d_str, 0) + int(s["quantity"])

                # Zero fill days in the 30-day window
                quantities = [daily_sums.get((thirty_days_ago + timedelta(days=i)).strftime("%Y-%m-%d"), 0) for i in range(30)]
                daily_demand_mean = float(np.mean(quantities))
                daily_demand_std = float(np.std(quantities))
            else:
                # Fallback to configured base rate
                daily_demand_mean = max(1.0, float(prod.get("reorder_threshold", 10)) / 7.0)
                daily_demand_std = daily_demand_mean * 0.3

            daily_demand_mean = max(0.1, daily_demand_mean)
            daily_demand_std = max(0.1, daily_demand_std)

            # 3. Formula: Safety Stock (SS)
            # SS = Z * sqrt( L * sigma_d^2 + d_bar^2 * sigma_L^2 )
            ss_term = (lead_time * (daily_demand_std ** 2)) + ((daily_demand_mean ** 2) * (lead_time_variance ** 2))
            safety_stock_calc = int(math.ceil(z_score * math.sqrt(ss_term)))
            safety_stock_calc = max(5, safety_stock_calc)

            # 4. Formula: Lead Time Demand (LTD) & Reorder Point (ROP)
            lead_time_demand = daily_demand_mean * lead_time
            reorder_point = int(math.ceil(lead_time_demand + safety_stock_calc))

            # 5. Formula: Economic Order Quantity (EOQ)
            # EOQ = sqrt( (2 * D_annual * S) / H )
            annual_demand = daily_demand_mean * 365.0
            holding_cost_per_unit = unit_cost * holding_rate
            eoq_raw = math.sqrt((2.0 * annual_demand * order_cost_fixed) / max(0.01, holding_cost_per_unit))
            eoq = int(math.ceil(eoq_raw))

            # 6. Formula: Days Until Stockout
            days_until_stockout = round(current_stock / daily_demand_mean, 1)

            # 7. Recommended Reorder Quantity (ROQ) & Urgency Classification
            if current_stock <= safety_stock_calc or days_until_stockout <= lead_time:
                urgency = RecommendationUrgency.CRITICAL
                deficit = (reorder_point + safety_stock_calc) - current_stock
                recommended_qty = max(eoq, deficit)
                reasoning = (
                    f"Stock is critically low ({current_stock} units). Estimated stockout in "
                    f"{days_until_stockout} days, which is within supplier lead time ({lead_time} days)."
                )
            elif current_stock <= reorder_point:
                urgency = RecommendationUrgency.WARNING
                deficit = reorder_point - current_stock + safety_stock_calc
                recommended_qty = max(eoq, deficit)
                reasoning = (
                    f"Stock ({current_stock} units) has crossed the reorder point ({reorder_point} units). "
                    f"Order replenishment to avoid buffer erosion."
                )
            else:
                urgency = RecommendationUrgency.OPTIMAL
                recommended_qty = 0
                reasoning = (
                    f"Stock ({current_stock} units) is above reorder point ({reorder_point} units). "
                    f"Current inventory provides {days_until_stockout} days of coverage."
                )

            # Ensure integer quantity rounded up to whole units
            recommended_qty = int(math.ceil(recommended_qty))
            estimated_cost = round(recommended_qty * unit_cost, 2)

            rec = ReorderRecommendationOut(
                product_id=str(prod["_id"]),
                sku=prod["sku"],
                product_name=prod["name"],
                category=prod["category"],
                current_stock=current_stock,
                daily_demand_rate=round(daily_demand_mean, 2),
                lead_time_days=lead_time,
                safety_stock=safety_stock_calc,
                reorder_point=reorder_point,
                recommended_reorder_quantity=recommended_qty,
                days_until_stockout=days_until_stockout,
                urgency=urgency,
                estimated_cost=estimated_cost,
                supplier_id=str(sup.get("_id")) if sup.get("_id") else None,
                supplier_name=sup.get("name", "Unknown Supplier"),
                reasoning=reasoning,
                calculation_breakdown={
                    "daily_demand_mean": round(daily_demand_mean, 2),
                    "daily_demand_std": round(daily_demand_std, 2),
                    "lead_time_days": lead_time,
                    "lead_time_variance_days": lead_time_variance,
                    "service_level_z_score": z_score,
                    "lead_time_demand": round(lead_time_demand, 2),
                    "safety_stock_formula": "Z * sqrt(L * sigma_d^2 + d_bar^2 * sigma_L^2)",
                    "calculated_safety_stock": safety_stock_calc,
                    "reorder_point_formula": "Lead_Time_Demand + Safety_Stock",
                    "calculated_reorder_point": reorder_point,
                    "eoq_formula": "sqrt((2 * D_annual * S) / H)",
                    "calculated_eoq": eoq
                }
            )

            if not urgency_filter or urgency_filter.upper() == "ALL" or rec.urgency.value == urgency_filter.upper():
                recommendations.append(rec)

        # Sort recommendations: CRITICAL first, then WARNING, then OPTIMAL
        urgency_rank = {RecommendationUrgency.CRITICAL: 0, RecommendationUrgency.WARNING: 1, RecommendationUrgency.OPTIMAL: 2}
        recommendations.sort(key=lambda r: (urgency_rank[r.urgency], r.days_until_stockout))

        return recommendations
