"""
System & Health Check REST Router
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from pymongo.database import Database
from app.config import settings
from app.db.connection import get_db, db_manager
from app.db.seed_data import seed_database
from app.models.schemas import HealthResponse, MessageResponse

router = APIRouter(tags=["System & Health"])


@router.get("/health", response_model=HealthResponse)
@router.get("/api/health", response_model=HealthResponse)
def health_check():
    """
    Standard health check endpoint for monitoring, uptime checks, and load balancers.
    """
    is_connected = db_manager.ping()
    return HealthResponse(
        status="healthy" if is_connected else "degraded",
        version="1.0.0",
        database_connected=is_connected,
        environment=settings.environment,
        timestamp=datetime.now(timezone.utc)
    )


@router.post("/api/system/seed")
def seed_data(
    force: bool = Query(False, description="Set True to overwrite and regenerate 180 days of sales data"),
    db: Database = Depends(get_db)
):
    """
    Seeds database with 20 realistic products, 5 suppliers, and 180 continuous days of sales.
    """
    return seed_database(db, force=force)


@router.post("/api/system/reset")
def reset_database(db: Database = Depends(get_db)):
    """
    Completely resets and reseeds the database with clean baseline data.
    """
    return seed_database(db, force=True)
