"""
Analytics Service
Implements MongoDB syllabus aggregation pipelines using:
$match, $group, $sort, $project, $lookup, $unwind, $limit, $count
Generates daily/monthly revenue trends, category performance, and top-selling products.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
from pymongo.database import Database
from app.models.schemas import (
    DateRevenueAgg,
    CategorySalesAgg,
    TopProductAgg,
    DashboardSummary
)


class AnalyticsService:
    @classmethod
    def get_dashboard_summary(cls, db: Database) -> DashboardSummary:
        """
        Executes aggregations to compile real-time dashboard KPIs.
        """
        total_products = db.products.count_documents({})
        low_stock_count = db.products.count_documents({"$expr": {"$lte": ["$current_stock", "$reorder_threshold"]}})
        out_of_stock_count = db.products.count_documents({"current_stock": 0})

        # Aggregation: total units in stock and inventory valuation
        inv_agg = list(db.products.aggregate([
            {
                "$project": {
                    "current_stock": 1,
                    "cost_price": {"$ifNull": ["$cost_price", 0.0]},
                    "stock_value": {"$multiply": ["$current_stock", {"$ifNull": ["$cost_price", 0.0]}]}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_units": {"$sum": "$current_stock"},
                    "total_valuation": {"$sum": "$stock_value"}
                }
            }
        ]))

        total_stock_units = inv_agg[0]["total_units"] if inv_agg else 0
        total_valuation = round(inv_agg[0]["total_valuation"], 2) if inv_agg else 0.0

        # Aggregation: 30-day revenue and order counts
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        recent_sales_agg = list(db.sales.aggregate([
            {"$match": {"sale_date": {"$gte": thirty_days_ago}}},
            {
                "$group": {
                    "_id": None,
                    "recent_revenue": {"$sum": "$total_amount"},
                    "recent_orders": {"$sum": 1}
                }
            }
        ]))

        recent_revenue = round(recent_sales_agg[0]["recent_revenue"], 2) if recent_sales_agg else 0.0
        recent_orders = recent_sales_agg[0]["recent_orders"] if recent_sales_agg else 0

        # Pending purchase orders
        pending_po_count = db.purchase_orders.count_documents({"status": {"$in": ["PENDING", "ORDERED"]}})

        return DashboardSummary(
            total_products=total_products,
            low_stock_products_count=low_stock_count,
            out_of_stock_products_count=out_of_stock_count,
            total_stock_units=total_stock_units,
            total_inventory_valuation=total_valuation,
            recent_30d_revenue=recent_revenue,
            recent_30d_orders=recent_orders,
            pending_purchase_orders_count=pending_po_count,
            active_reorder_recommendations_count=low_stock_count
        )

    @classmethod
    def get_revenue_trends(
        cls,
        db: Database,
        days: int = 30
    ) -> List[DateRevenueAgg]:
        """
        Aggregation Pipeline:
        1. $match: Filter transactions within specified timeframe
        2. $project: Format sale_date into YYYY-MM-DD date string
        3. $group: Group by date string, summing total_amount and quantity
        4. $sort: Sort chronologically by date
        """
        start_date = datetime.now(timezone.utc) - timedelta(days=days)

        pipeline = [
            {"$match": {"sale_date": {"$gte": start_date}}},
            {
                "$project": {
                    "date_str": {"$dateToString": {"format": "%Y-%m-%d", "date": "$sale_date"}},
                    "total_amount": 1,
                    "quantity": 1
                }
            },
            {
                "$group": {
                    "_id": "$date_str",
                    "revenue": {"$sum": "$total_amount"},
                    "orders_count": {"$sum": 1},
                    "units_sold": {"$sum": "$quantity"}
                }
            },
            {"$sort": {"_id": 1}},
            {
                "$project": {
                    "_id": 0,
                    "date": "$_id",
                    "revenue": {"$round": ["$revenue", 2]},
                    "orders_count": 1,
                    "units_sold": 1
                }
            }
        ]

        cursor = db.sales.aggregate(pipeline)
        return [DateRevenueAgg(**doc) for doc in cursor]

    @classmethod
    def get_category_performance(cls, db: Database) -> List[CategorySalesAgg]:
        """
        Aggregation Pipeline:
        1. $lookup: Join sales with products to obtain current product category
        2. $unwind: Deconstruct the product array
        3. $group: Aggregate sales volume, revenue, and unique product count by category
        4. $sort: Sort by highest revenue
        """
        pipeline = [
            {
                "$lookup": {
                    "from": "products",
                    "localField": "product_id",
                    "foreignField": "_id",
                    "as": "product_info"
                }
            },
            {"$unwind": "$product_info"},
            {
                "$group": {
                    "_id": "$product_info.category",
                    "total_revenue": {"$sum": "$total_amount"},
                    "total_units_sold": {"$sum": "$quantity"},
                    "unique_products": {"$addToSet": "$product_info._id"}
                }
            },
            {"$sort": {"total_revenue": -1}}
        ]

        raw_results = list(db.sales.aggregate(pipeline))
        grand_total_revenue = sum(r["total_revenue"] for r in raw_results) or 1.0

        output = []
        for r in raw_results:
            cat_rev = round(r["total_revenue"], 2)
            pct = round((cat_rev / grand_total_revenue) * 100.0, 1)
            output.append(
                CategorySalesAgg(
                    category=r["_id"] or "Uncategorized",
                    total_revenue=cat_rev,
                    total_units_sold=r["total_units_sold"],
                    product_count=len(r.get("unique_products", [])),
                    revenue_percentage=pct
                )
            )
        return output

    @classmethod
    def get_top_selling_products(
        cls,
        db: Database,
        limit: int = 10,
        days: int = 90
    ) -> List[TopProductAgg]:
        """
        Aggregation Pipeline:
        1. $match: Filter sales for timeframe
        2. $group: Aggregate sum of quantity and revenue by product_id
        3. $sort: Order descending by total_units_sold
        4. $limit: Restrict to top N products
        5. $lookup: Join product catalog details
        6. $unwind: Extract joined product details
        """
        start_date = datetime.now(timezone.utc) - timedelta(days=days)

        pipeline = [
            {"$match": {"sale_date": {"$gte": start_date}}},
            {
                "$group": {
                    "_id": "$product_id",
                    "total_units_sold": {"$sum": "$quantity"},
                    "total_revenue": {"$sum": "$total_amount"}
                }
            },
            {"$sort": {"total_units_sold": -1}},
            {"$limit": limit},
            {
                "$lookup": {
                    "from": "products",
                    "localField": "_id",
                    "foreignField": "_id",
                    "as": "product_doc"
                }
            },
            {"$unwind": "$product_doc"},
            {
                "$project": {
                    "_id": 0,
                    "product_id": {"$toString": "$_id"},
                    "sku": "$product_doc.sku",
                    "name": "$product_doc.name",
                    "category": "$product_doc.category",
                    "total_units_sold": 1,
                    "total_revenue": {"$round": ["$total_revenue", 2]},
                    "current_stock": "$product_doc.current_stock"
                }
            }
        ]

        cursor = db.sales.aggregate(pipeline)
        return [TopProductAgg(**doc) for doc in cursor]
