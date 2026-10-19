"""
Settings REST Router
"""

from fastapi import APIRouter, Depends
from pymongo.database import Database
from app.db.connection import get_db
from app.models.schemas import SystemSettings
from app.services.settings_service import SettingsService

router = APIRouter(prefix="/api/settings", tags=["System Settings"])


@router.get("", response_model=SystemSettings)
def get_settings(db: Database = Depends(get_db)):
    """
    Retrieve configurable inventory thresholds, service level Z-score, and cost parameters.
    """
    return SettingsService.get_settings(db)


@router.put("", response_model=SystemSettings)
def update_settings(payload: SystemSettings, db: Database = Depends(get_db)):
    """
    Update inventory policy assumptions and service level targets.
    """
    return SettingsService.update_settings(db, payload)
