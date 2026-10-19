"""
FastAPI Application Entry Point
Intelligent Inventory & Demand Forecasting System
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.config import settings
from app.db.connection import db_manager
from app.db.schemas import apply_json_schema_validators
from app.db.indexes import ensure_indexes
from app.db.seed_data import seed_database

from app.routers import (
    system,
    products,
    sales,
    suppliers,
    purchase_orders,
    forecasts,
    recommendations,
    analytics,
    performance,
    settings as settings_router
)

# Setup logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("inventory_system")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application Lifespan Event Handler.
    Initializes database connection pool, applies collection schema validations,
    ensures proper indexes, and verifies initial seed data.
    """
    logger.info("Starting up Intelligent Inventory & Demand Forecasting API...")
    try:
        db = db_manager.connect()
        # Apply JSON Schema validators
        apply_json_schema_validators(db)
        # Ensure compound and unique indexes
        ensure_indexes(db)
        # Auto-seed if database is fresh
        seed_database(db, force=False)
        logger.info("Application initialization and database preparation complete.")
    except Exception as e:
        logger.warning(
            f"Database startup hook encountered an issue: {e}. "
            f"The application will continue running with degraded database status."
        )

    yield

    logger.info("Shutting down API and releasing connection pools...")
    db_manager.close()


app = FastAPI(
    title="Intelligent Inventory & Demand Forecasting API",
    description=(
        "Production-minded REST API for small retailers, supermarkets, and warehouses. "
        "Provides product catalog management, sales transaction processing with strict stock deduction, "
        "reorder point recommendations, scikit-learn demand forecasting, and MongoDB syllabus demonstrations."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Centralized Exception Handlers
@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": "Bad Request", "detail": str(exc)}
    )


@app.exception_handler(DuplicateKeyError)
async def duplicate_key_error_handler(request: Request, exc: DuplicateKeyError):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "error": "Conflict",
            "detail": "A record with this unique identifier (SKU, code, or idempotency key) already exists."
        }
    )


@app.exception_handler(PyMongoError)
async def pymongo_error_handler(request: Request, exc: PyMongoError):
    logger.error(f"Database error during request {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Database Error", "detail": "An internal database operation failed."}
    )


# Register Routers
app.include_router(system.router)
app.include_router(products.router)
app.include_router(sales.router)
app.include_router(suppliers.router)
app.include_router(purchase_orders.router)
app.include_router(forecasts.router)
app.include_router(recommendations.router)
app.include_router(analytics.router)
app.include_router(performance.router)
app.include_router(settings_router.router)


@app.get("/")
def root():
    return {
        "service": "Intelligent Inventory & Demand Forecasting API",
        "version": "1.0.0",
        "documentation": "/docs",
        "status": "operational"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.port, reload=True)
