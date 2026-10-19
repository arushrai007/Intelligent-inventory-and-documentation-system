"""
Sales REST Router
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pymongo.database import Database
from app.db.connection import get_db
from app.models.schemas import (
    SaleCreate,
    SaleOut,
    PaginatedSalesResponse
)
from app.services.sales_service import SalesService

router = APIRouter(prefix="/api/sales", tags=["Sales"])


@router.post("", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
def record_sale(payload: SaleCreate, db: Database = Depends(get_db)):
    """
    Records a customer sale transaction.
    - Validates sufficient available inventory.
    - Atomically decrements product current_stock.
    - Rejects transactions exceeding available stock.
    - Blocks duplicate submissions using idempotency_key.
    """
    try:
        return SalesService.record_sale(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing transaction: {str(e)}"
        )


@router.get("", response_model=PaginatedSalesResponse)
def list_sales(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    product_id: Optional[str] = Query(None, description="Filter by product ID"),
    sku: Optional[str] = Query(None, description="Filter by SKU"),
    db: Database = Depends(get_db)
):
    """
    List sales transaction history with descending date sorting and pagination.
    """
    items, pagination = SalesService.list_sales(
        db=db,
        page=page,
        page_size=page_size,
        product_id=product_id,
        sku=sku
    )
    return PaginatedSalesResponse(items=items, pagination=pagination)
