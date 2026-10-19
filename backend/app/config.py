from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    port: int = 8000
    environment: str = "development"
    log_level: str = "info"

    # MongoDB settings
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_database: str = "inventory_forecasting"

    # CORS Allowed Origins (comma separated string)
    cors_allowed_origins: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"

    # Inventory Policy Defaults
    default_forecast_horizon_days: int = 14
    default_safety_stock_z_score: float = 1.65  # 95% service level
    default_lead_time_days: int = 7
    default_annual_holding_cost_rate: float = 0.20  # 20% annual holding cost
    default_order_cost: float = 50.0  # Fixed ordering cost per PO

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        if not self.cors_allowed_origins:
            return ["*"]
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]


settings = Settings()
