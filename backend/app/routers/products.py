"""
Products REST Router
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pymongo.database import Database
from app.db.connection import get_db
from app.models.schemas import (
    ProductCreate,
    ProductUpdate,
    ProductOut,
    PaginatedProductsResponse,
    MessageResponse
)
from app.services.product_service import ProductService

router = APIRouter(prefix="/api/products", tags=["Products"])


@router.get("", response_model=PaginatedProductsResponse)
def list_products(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term for name or SKU"),
    category: Optional[str] = Query(None, description="Filter by category"),
    low_stock_only: bool = Query(False, description="Filter items at or below reorder threshold"),
    sort_by: str = Query("name", description="Field to sort by: name, sku, price, current_stock"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$", description="Sort order"),
    db: Database = Depends(get_db)
):
    """
    Search, filter, sort, and paginate product inventory.
    """
    items, pagination = ProductService.list_products(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        category=category,
        low_stock_only=low_stock_only,
        sort_by=sort_by,
        sort_order=sort_order
    )
    return PaginatedProductsResponse(items=items, pagination=pagination)


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: str, db: Database = Depends(get_db)):
    """
    Retrieve single product by its unique ObjectId.
    """
    prod = ProductService.get_by_id(db, product_id)
    if not prod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID '{product_id}' not found."
        )
    return prod


@router.get("/sku/{sku}", response_model=ProductOut)
def get_product_by_sku(sku: str, db: Database = Depends(get_db)):
    """
    Retrieve product by unique SKU code.
    """
    prod = ProductService.get_by_sku(db, sku)
    if not prod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with SKU '{sku}' not found."
        )
    return prod


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: Database = Depends(get_db)):
    """
    Create a new product with stock and pricing validation.
    """
    try:
        return ProductService.create_product(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: str, payload: ProductUpdate, db: Database = Depends(get_db)):
    """
    Update product details, pricing, or stock parameters.
    """
    try:
        updated = ProductService.update_product(db, product_id, payload)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID '{product_id}' not found."
            )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{product_id}", response_model=MessageResponse)
def delete_product(product_id: str, db: Database = Depends(get_db)):
    """
    Delete a product if it has no sales history.
    """
    try:
        success = ProductService.delete_product(db, product_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID '{product_id}' not found."
            )
        return MessageResponse(status="success", message=f"Product '{product_id}' deleted successfully.")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
