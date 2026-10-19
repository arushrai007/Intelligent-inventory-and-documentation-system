"""
Analytics REST Router
"""

from typing import List
from fastapi import APIRouter, Depends, Query
from pymongo.database import Database
from app.db.connection import get_db
from app.models.schemas import (
    DashboardSummary,
    DateRevenueAgg,
    CategorySalesAgg,
    TopProductAgg
)
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/analytics", tags=["Analytics & Aggregations"])


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Database = Depends(get_db)):
    """
    Real-time inventory summary KPIs, active alerts, stock valuation, and 30-day revenue.
    """
    return AnalyticsService.get_dashboard_summary(db)


@router.get("/revenue-trends", response_model=List[DateRevenueAgg])
def get_revenue_trends(
    days: int = Query(30, ge=7, le=180, description="Timeframe window in days"),
    db: Database = Depends(get_db)
):
    """
    MongoDB Aggregation: Daily revenue, transaction counts, and unit sales volume.
    """
    return AnalyticsService.get_revenue_trends(db, days=days)


@router.get("/category-performance", response_model=List[CategorySalesAgg])
def get_category_performance(db: Database = Depends(get_db)):
    """
    MongoDB Aggregation: Sales volume and revenue breakdown grouped by product category.
    """
    return AnalyticsService.get_category_performance(db)


@router.get("/top-products", response_model=List[TopProductAgg])
def get_top_selling_products(
    limit: int = Query(10, ge=1, le=50, description="Max products to return"),
    days: int = Query(90, ge=7, le=180, description="Timeframe window in days"),
    db: Database = Depends(get_db)
):
    """
    MongoDB Aggregation: Best-selling products ranked by units sold and revenue.
    """
    return AnalyticsService.get_top_selling_products(db, limit=limit, days=days)
