"""
Purchase Order Service
Manages order generation, status workflows (PENDING, ORDERED, RECEIVED, CANCELLED),
idempotent stock receiving, and duplicate prevention.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from pymongo.database import Database
from pymongo import DESCENDING
from app.models.schemas import (
    PurchaseOrderCreate,
    PurchaseOrderOut,
    PurchaseOrderItem,
    POStatusEnum
)


class PurchaseOrderService:
    @staticmethod
    def _doc_to_model(doc: Dict[str, Any], supplier_name: Optional[str] = None) -> PurchaseOrderOut:
        items = [
            PurchaseOrderItem(
                product_id=str(it["product_id"]),
                sku=it["sku"],
                product_name=it["product_name"],
                quantity=int(it["quantity"]),
                unit_cost=float(it["unit_cost"]),
                received_quantity=int(it.get("received_quantity", 0))
            )
            for it in doc.get("items", [])
        ]

        return PurchaseOrderOut(
            id=str(doc["_id"]),
            po_number=doc["po_number"],
            supplier_id=str(doc["supplier_id"]),
            supplier_name=supplier_name or doc.get("supplier_name"),
            status=POStatusEnum(doc["status"]),
            items=items,
            total_cost=float(doc["total_cost"]),
            created_at=doc["created_at"],
            expected_delivery_date=doc.get("expected_delivery_date"),
            received_at=doc.get("received_at"),
            notes=doc.get("notes")
        )

    @classmethod
    def _generate_po_number(cls, db: Database) -> str:
        current_year = datetime.now(timezone.utc).year
        # Count existing POs for this year
        prefix = f"PO-{current_year}-"
        count = db.purchase_orders.count_documents({"po_number": {"$regex": f"^{prefix}"}})
        return f"{prefix}{count + 1:04d}"

    @classmethod
    def create_purchase_order(cls, db: Database, payload: PurchaseOrderCreate) -> PurchaseOrderOut:
        # Validate supplier
        try:
            sup_obj_id = ObjectId(payload.supplier_id)
        except Exception:
            sup_obj_id = payload.supplier_id

        supplier = db.suppliers.find_one({"_id": sup_obj_id})
        if not supplier:
            raise ValueError(f"Supplier not found with ID: {payload.supplier_id}")

        now = datetime.now(timezone.utc)
        lead_time = supplier.get("lead_time_days", 7)
        expected_delivery = payload.expected_delivery_date or (now + timedelta(days=lead_time))

        # Validate items and calculate total
        total_cost = 0.0
        validated_items = []

        for item in payload.items:
            try:
                prod_obj_id = ObjectId(item.product_id)
            except Exception:
                prod_obj_id = item.product_id

            product = db.products.find_one({"_id": prod_obj_id})
            if not product:
                raise ValueError(f"Product not found with ID: {item.product_id}")

            unit_cost = item.unit_cost if item.unit_cost > 0 else product.get("cost_price", 0.0)
            total_cost += unit_cost * item.quantity

            validated_items.append({
                "product_id": product["_id"],
                "sku": product["sku"],
                "product_name": product["name"],
                "quantity": item.quantity,
                "unit_cost": unit_cost,
                "received_quantity": 0
            })

        po_number = cls._generate_po_number(db)
        doc = {
            "po_number": po_number,
            "supplier_id": supplier["_id"],
            "supplier_name": supplier["name"],
            "status": POStatusEnum.PENDING.value,
            "items": validated_items,
            "total_cost": round(total_cost, 2),
            "created_at": now,
            "expected_delivery_date": expected_delivery,
            "received_at": None,
            "notes": payload.notes
        }

        res = db.purchase_orders.insert_one(doc)
        doc["_id"] = res.inserted_id
        return cls._doc_to_model(doc, supplier["name"])

    @classmethod
    def list_orders(
        cls,
        db: Database,
        status: Optional[str] = None,
        supplier_id: Optional[str] = None
    ) -> List[PurchaseOrderOut]:
        query: Dict[str, Any] = {}
        if status and status.upper() != "ALL":
            query["status"] = status.upper()

        if supplier_id:
            try:
                query["supplier_id"] = ObjectId(supplier_id)
            except Exception:
                query["supplier_id"] = supplier_id

        cursor = db.purchase_orders.find(query).sort("created_at", DESCENDING)
        orders = []
        for doc in cursor:
            orders.append(cls._doc_to_model(doc))
        return orders

    @classmethod
    def get_by_id(cls, db: Database, po_id: str) -> Optional[PurchaseOrderOut]:
        try:
            obj_id = ObjectId(po_id)
            query = {"_id": obj_id}
        except Exception:
            query = {"_id": po_id}

        doc = db.purchase_orders.find_one(query)
        if not doc:
            return None
        return cls._doc_to_model(doc)

    @classmethod
    def update_status(cls, db: Database, po_id: str, new_status: POStatusEnum) -> PurchaseOrderOut:
        try:
            obj_id = ObjectId(po_id)
            query = {"_id": obj_id}
        except Exception:
            query = {"_id": po_id}

        existing = db.purchase_orders.find_one(query)
        if not existing:
            raise ValueError(f"Purchase order not found with ID: {po_id}")

        if existing["status"] == POStatusEnum.RECEIVED.value:
            raise ValueError("Cannot change status of an already received purchase order.")

        db.purchase_orders.update_one(query, {"$set": {"status": new_status.value}})
        return cls.get_by_id(db, po_id)

    @classmethod
    def receive_order(cls, db: Database, po_id: str, notes: Optional[str] = None) -> PurchaseOrderOut:
        """
        Receives an active purchase order and increments inventory.
        Guarantees idempotency: uses atomic conditional update on status != 'RECEIVED'
        to prevent duplicate stock increments.
        """
        try:
            obj_id = ObjectId(po_id)
            query = {"_id": obj_id}
        except Exception:
            query = {"_id": po_id}

        now = datetime.now(timezone.utc)

        # 1. Atomic status transition from PENDING/ORDERED -> RECEIVED
        # Only succeeds if order has NOT already been marked RECEIVED
        update_filter = {
            "_id": query["_id"],
            "status": {"$in": [POStatusEnum.PENDING.value, POStatusEnum.ORDERED.value]}
        }
        update_doc = {
            "$set": {
                "status": POStatusEnum.RECEIVED.value,
                "received_at": now,
                "received_notes": notes
            }
        }

        result = db.purchase_orders.update_one(update_filter, update_doc)
        if result.matched_count == 0:
            existing = db.purchase_orders.find_one(query)
            if not existing:
                raise ValueError(f"Purchase order not found: {po_id}")
            if existing["status"] == POStatusEnum.RECEIVED.value:
                raise ValueError(f"Duplicate receipt blocked: Purchase order {existing.get('po_number')} has already been received on {existing.get('received_at')}.")
            raise ValueError(f"Cannot receive purchase order with status '{existing.get('status')}'.")

        # 2. Fetch the order details to update inventory
        order = db.purchase_orders.find_one(query)
        for item in order.get("items", []):
            qty = item["quantity"]
            prod_id = item["product_id"]

            # Increment stock in products collection
            db.products.update_one(
                {"_id": prod_id},
                {
                    "$inc": {"current_stock": qty},
                    "$set": {"updated_at": now}
                }
            )

        # Update item received_quantity
        db.purchase_orders.update_one(
            query,
            {"$set": {"items.$[].received_quantity": item["quantity"]}}
        )

        return cls.get_by_id(db, po_id)
