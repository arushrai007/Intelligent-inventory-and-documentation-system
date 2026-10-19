"""
Reorder Recommendations REST Router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pymongo.database import Database
from app.db.connection import get_db
from app.models.schemas import (
    ReorderRecommendationOut,
    PurchaseOrderCreate,
    PurchaseOrderItem,
    PurchaseOrderOut
)
from app.services.recommendation_service import RecommendationService
from app.services.purchase_order_service import PurchaseOrderService
from app.services.product_service import ProductService

router = APIRouter(prefix="/api/recommendations", tags=["Reorder Recommendations"])


@router.get("", response_model=List[ReorderRecommendationOut])
def get_reorder_recommendations(
    urgency: Optional[str] = Query(None, description="Filter: ALL, CRITICAL, WARNING, OPTIMAL"),
    db: Database = Depends(get_db)
):
    """
    Computes real-time reorder recommendations using documented inventory formulas:
    - Reorder Point (ROP) = Lead Time Demand + Safety Stock
    - Safety Stock = Z * sqrt(L * sigma_d^2 + d_bar^2 * sigma_L^2)
    - EOQ = sqrt((2 * D * S) / H)
    - Days until stockout
    - Urgency classification: CRITICAL, WARNING, OPTIMAL
    """
    return RecommendationService.generate_recommendations(db, urgency_filter=urgency)


@router.post("/convert-to-po", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
def convert_recommendation_to_po(
    product_id: str = Query(..., description="Product ID to convert"),
    quantity: Optional[int] = Query(None, ge=1, description="Override quantity, or uses recommendation default"),
    db: Database = Depends(get_db)
):
    """
    Directly converts an active reorder recommendation into an official Purchase Order.
    """
    prod = ProductService.get_by_id(db, product_id)
    if not prod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    if not prod.supplier_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot generate Purchase Order: Product has no assigned supplier."
        )

    # Determine recommended quantity if not overridden
    order_qty = quantity
    if not order_qty:
        recs = RecommendationService.generate_recommendations(db)
        match_rec = next((r for r in recs if r.product_id == product_id), None)
        order_qty = match_rec.recommended_reorder_quantity if match_rec else max(20, prod.reorder_threshold)
        if order_qty <= 0:
            order_qty = max(20, prod.reorder_threshold)

    po_payload = PurchaseOrderCreate(
        supplier_id=prod.supplier_id,
        items=[
            PurchaseOrderItem(
                product_id=prod.id,
                sku=prod.sku,
                product_name=prod.name,
                quantity=order_qty,
                unit_cost=prod.cost_price,
                received_quantity=0
            )
        ],
        notes=f"Auto-generated purchase order from intelligent reorder recommendation for {prod.name}."
    )

    try:
        return PurchaseOrderService.create_purchase_order(db, po_payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
