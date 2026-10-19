"""
Settings Service
Manages system configuration and inventory policies in MongoDB.
"""

from typing import Dict, Any
from datetime import datetime, timezone
from pymongo.database import Database
from app.models.schemas import SystemSettings


class SettingsService:
    SETTINGS_KEY = "inventory_policy"

    @classmethod
    def get_settings(cls, db: Database) -> SystemSettings:
        doc = db.system_settings.find_one({"key": cls.SETTINGS_KEY})
        if not doc:
            return SystemSettings()
        return SystemSettings(
            default_lead_time_days=int(doc.get("default_lead_time_days", 7)),
            safety_stock_z_score=float(doc.get("safety_stock_z_score", 1.65)),
            annual_holding_cost_rate=float(doc.get("annual_holding_cost_rate", 0.20)),
            fixed_order_cost=float(doc.get("fixed_order_cost", 50.0)),
            forecast_horizon_days=int(doc.get("forecast_horizon_days", 14)),
            auto_reorder_enabled=bool(doc.get("auto_reorder_enabled", False)),
            updated_at=doc.get("updated_at")
        )

    @classmethod
    def update_settings(cls, db: Database, payload: SystemSettings) -> SystemSettings:
        now = datetime.now(timezone.utc)
        doc = payload.model_dump()
        doc["key"] = cls.SETTINGS_KEY
        doc["updated_at"] = now

        db.system_settings.update_one(
            {"key": cls.SETTINGS_KEY},
            {"$set": doc},
            upsert=True
        )
        return cls.get_settings(db)
