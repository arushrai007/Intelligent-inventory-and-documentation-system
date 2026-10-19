"""
Suppliers REST Router
"""

from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pymongo.database import Database
from app.db.connection import get_db
from app.models.schemas import (
    SupplierCreate,
    SupplierUpdate,
    SupplierOut,
    MessageResponse
)
from app.services.supplier_service import SupplierService

router = APIRouter(prefix="/api/suppliers", tags=["Suppliers"])


@router.get("", response_model=List[SupplierOut])
def list_suppliers(
    active_only: bool = Query(False, description="Filter for active suppliers only"),
    db: Database = Depends(get_db)
):
    """
    List all registered suppliers with their average lead times and product counts.
    """
    return SupplierService.list_suppliers(db, active_only=active_only)


@router.get("/{supplier_id}", response_model=SupplierOut)
def get_supplier(supplier_id: str, db: Database = Depends(get_db)):
    """
    Retrieve supplier by ID.
    """
    sup = SupplierService.get_by_id(db, supplier_id)
    if not sup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with ID '{supplier_id}' not found."
        )
    return sup


@router.post("", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(payload: SupplierCreate, db: Database = Depends(get_db)):
    """
    Register a new supplier.
    """
    try:
        return SupplierService.create_supplier(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{supplier_id}", response_model=SupplierOut)
def update_supplier(supplier_id: str, payload: SupplierUpdate, db: Database = Depends(get_db)):
    """
    Update supplier lead time, contact details, or active status.
    """
    try:
        updated = SupplierService.update_supplier(db, supplier_id, payload)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Supplier with ID '{supplier_id}' not found."
            )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{supplier_id}", response_model=MessageResponse)
def delete_supplier(supplier_id: str, db: Database = Depends(get_db)):
    """
    Delete a supplier if no products are associated with it.
    """
    try:
        success = SupplierService.delete_supplier(db, supplier_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Supplier with ID '{supplier_id}' not found."
            )
        return MessageResponse(status="success", message="Supplier deleted successfully.")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
