"""
Supplier Service
Manages supplier master data, lead times, contact details, and product linkages.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
from pymongo.database import Database
from pymongo import ASCENDING
from app.models.schemas import SupplierCreate, SupplierUpdate, SupplierOut


class SupplierService:
    @staticmethod
    def _doc_to_model(doc: Dict[str, Any], product_count: int = 0) -> SupplierOut:
        return SupplierOut(
            id=str(doc["_id"]),
            supplier_code=doc["supplier_code"],
            name=doc["name"],
            contact_email=doc["contact_email"],
            phone=doc["phone"],
            lead_time_days=int(doc["lead_time_days"]),
            lead_time_variance_days=float(doc.get("lead_time_variance_days", 1.0)),
            active=bool(doc.get("active", True)),
            product_count=product_count,
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at")
        )

    @classmethod
    def list_suppliers(cls, db: Database, active_only: bool = False) -> List[SupplierOut]:
        match_query = {"active": True} if active_only else {}

        # Aggregate with lookup to count associated products
        pipeline = [
            {"$match": match_query},
            {"$sort": {"name": ASCENDING}},
            {
                "$lookup": {
                    "from": "products",
                    "let": {"sup_id": "$_id", "sup_code": "$supplier_code"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$or": [
                                        {"$eq": ["$supplier_id", "$$sup_id"]},
                                        {"$eq": ["$supplier_code", "$$sup_code"]}
                                    ]
                                }
                            }
                        },
                        {"$count": "count"}
                    ],
                    "as": "products_agg"
                }
            },
            {
                "$addFields": {
                    "product_count": {
                        "$ifNull": [{"$arrayElemAt": ["$products_agg.count", 0]}, 0]
                    }
                }
            }
        ]

        cursor = db.suppliers.aggregate(pipeline)
        return [cls._doc_to_model(doc, doc.get("product_count", 0)) for doc in cursor]

    @classmethod
    def get_by_id(cls, db: Database, supplier_id: str) -> Optional[SupplierOut]:
        try:
            obj_id = ObjectId(supplier_id)
            query = {"_id": obj_id}
        except Exception:
            query = {"_id": supplier_id}

        doc = db.suppliers.find_one(query)
        if not doc:
            return None

        # Count products
        prod_count = db.products.count_documents({
            "$or": [
                {"supplier_id": doc["_id"]},
                {"supplier_code": doc.get("supplier_code")}
            ]
        })
        return cls._doc_to_model(doc, prod_count)

    @classmethod
    def create_supplier(cls, db: Database, payload: SupplierCreate) -> SupplierOut:
        # Check code uniqueness
        if db.suppliers.find_one({"supplier_code": payload.supplier_code.upper()}):
            raise ValueError(f"Supplier with code '{payload.supplier_code.upper()}' already exists.")

        now = datetime.now(timezone.utc)
        doc = {
            "supplier_code": payload.supplier_code.upper(),
            "name": payload.name,
            "contact_email": payload.contact_email,
            "phone": payload.phone,
            "lead_time_days": payload.lead_time_days,
            "lead_time_variance_days": payload.lead_time_variance_days,
            "active": payload.active,
            "created_at": now,
            "updated_at": now
        }
        res = db.suppliers.insert_one(doc)
        doc["_id"] = res.inserted_id
        return cls._doc_to_model(doc, 0)

    @classmethod
    def update_supplier(cls, db: Database, supplier_id: str, payload: SupplierUpdate) -> Optional[SupplierOut]:
        try:
            obj_id = ObjectId(supplier_id)
            query = {"_id": obj_id}
        except Exception:
            query = {"_id": supplier_id}

        existing = db.suppliers.find_one(query)
        if not existing:
            return None

        update_fields = payload.model_dump(exclude_unset=True)
        if update_fields:
            update_fields["updated_at"] = datetime.now(timezone.utc)
            db.suppliers.update_one(query, {"$set": update_fields})

        return cls.get_by_id(db, supplier_id)

    @classmethod
    def delete_supplier(cls, db: Database, supplier_id: str) -> bool:
        try:
            obj_id = ObjectId(supplier_id)
            query = {"_id": obj_id}
        except Exception:
            query = {"_id": supplier_id}

        # Check for products linked to this supplier
        supplier = db.suppliers.find_one(query)
        if not supplier:
            return False

        linked_products = db.products.count_documents({
            "$or": [
                {"supplier_id": supplier["_id"]},
                {"supplier_code": supplier.get("supplier_code")}
            ]
        })
        if linked_products > 0:
            raise ValueError(f"Cannot delete supplier: {linked_products} product(s) are associated with it.")

        res = db.suppliers.delete_one(query)
        return res.deleted_count > 0
