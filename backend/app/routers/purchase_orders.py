"""
Purchase Orders REST Router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pymongo.database import Database
from app.db.connection import get_db
from app.models.schemas import (
    PurchaseOrderCreate,
    PurchaseOrderOut,
    PurchaseOrderReceiveRequest,
    POStatusEnum
)
from app.services.purchase_order_service import PurchaseOrderService

router = APIRouter(prefix="/api/purchase-orders", tags=["Purchase Orders"])


@router.get("", response_model=List[PurchaseOrderOut])
def list_purchase_orders(
    status: Optional[str] = Query(None, description="Filter by status: PENDING, ORDERED, RECEIVED, CANCELLED"),
    supplier_id: Optional[str] = Query(None, description="Filter by supplier ID"),
    db: Database = Depends(get_db)
):
    """
    List purchase orders with optional status or supplier filter.
    """
    return PurchaseOrderService.list_orders(db, status=status, supplier_id=supplier_id)


@router.get("/{po_id}", response_model=PurchaseOrderOut)
def get_purchase_order(po_id: str, db: Database = Depends(get_db)):
    """
    Retrieve single purchase order by ID.
    """
    po = PurchaseOrderService.get_by_id(db, po_id)
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase order with ID '{po_id}' not found."
        )
    return po


@router.post("", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
def create_purchase_order(payload: PurchaseOrderCreate, db: Database = Depends(get_db)):
    """
    Create a new purchase order.
    """
    try:
        return PurchaseOrderService.create_purchase_order(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/{po_id}/status", response_model=PurchaseOrderOut)
def update_status(po_id: str, new_status: POStatusEnum = Query(...), db: Database = Depends(get_db)):
    """
    Update lifecycle state of an active purchase order.
    """
    try:
        return PurchaseOrderService.update_status(db, po_id, new_status)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{po_id}/receive", response_model=PurchaseOrderOut)
def receive_order(
    po_id: str,
    payload: Optional[PurchaseOrderReceiveRequest] = None,
    db: Database = Depends(get_db)
):
    """
    Receive delivered purchase order:
    - Atomically increments on-hand stock for all line items.
    - Marks purchase order as RECEIVED with receipt timestamp.
    - Blocks duplicate receipt attempts idempotently.
    """
    notes = payload.received_notes if payload else None
    try:
        return PurchaseOrderService.receive_order(db, po_id, notes)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
