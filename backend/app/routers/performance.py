"""
Database Performance & Optimization REST Router
"""

from fastapi import APIRouter, Depends
from pymongo.database import Database
from app.db.connection import get_db
from app.models.schemas import PerformanceReport
from app.services.performance_service import PerformanceService
from app.db.indexes import get_collection_indexes_info

router = APIRouter(prefix="/api/performance", tags=["Database Performance & Explain"])


@router.get("/explain", response_model=PerformanceReport)
def run_explain_benchmark(db: Database = Depends(get_db)):
    """
    Executes live explain('executionStats') on MongoDB to inspect query optimization:
    - Compares compound index execution (IXSCAN) vs unindexed table scan (COLLSCAN).
    - Inspects real executionTimeMillis, totalDocsExamined, and totalKeysExamined.
    - Returns active index registry for core collections.
    """
    return PerformanceService.run_explain_benchmark(db)


@router.get("/indexes")
def get_indexes(db: Database = Depends(get_db)):
    """
    Returns active index list and key definitions across all collections.
    """
    return get_collection_indexes_info(db)
