"""
Sales Service
Handles sales transaction processing, strict stock deduction consistency,
rejection of sales exceeding available inventory, and duplicate transaction prevention.
"""

from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone
from bson import ObjectId
from pymongo.database import Database
from pymongo import DESCENDING
from pymongo.errors import DuplicateKeyError
from app.models.schemas import SaleCreate, SaleOut, PaginationMeta


class SalesService:
    @staticmethod
    def _doc_to_model(doc: Dict[str, Any], product_name: Optional[str] = None) -> SaleOut:
        return SaleOut(
            id=str(doc["_id"]),
            product_id=str(doc["product_id"]),
            sku=doc.get("sku", "UNKNOWN"),
            product_name=product_name or doc.get("product_name"),
            quantity=int(doc["quantity"]),
            unit_price=float(doc["unit_price"]),
            total_amount=float(doc["total_amount"]),
            sale_date=doc["sale_date"],
            idempotency_key=doc.get("idempotency_key")
        )

    @classmethod
    def record_sale(cls, db: Database, payload: SaleCreate) -> SaleOut:
        # 1. Check idempotency if key provided
        if payload.idempotency_key:
            existing_tx = db.sales.find_one({"idempotency_key": payload.idempotency_key})
            if existing_tx:
                # Return previously recorded transaction idempotently
                return cls._doc_to_model(existing_tx)

        # 2. Resolve Product
        try:
            prod_obj_id = ObjectId(payload.product_id)
            prod_query = {"_id": prod_obj_id}
        except Exception:
            prod_query = {"_id": payload.product_id}
            prod_obj_id = payload.product_id

        product = db.products.find_one(prod_query)
        if not product:
            raise ValueError(f"Product not found with ID: {payload.product_id}")

        available_stock = product.get("current_stock", 0)
        if available_stock < payload.quantity:
            raise ValueError(
                f"Insufficient stock for product '{product.get('name')}' ({product.get('sku')}). "
                f"Available: {available_stock}, Requested: {payload.quantity}"
            )

        unit_price = payload.unit_price if payload.unit_price is not None else product["unit_price"]
        total_amount = round(payload.quantity * unit_price, 2)
        sale_date = payload.sale_date or datetime.now(timezone.utc)

        # 3. Atomic stock reduction with inventory consistency check
        # This atomic query matches only if current_stock >= payload.quantity,
        # guaranteeing zero race conditions even without multi-doc transactions.
        update_result = db.products.update_one(
            {
                "_id": product["_id"],
                "current_stock": {"$gte": payload.quantity}
            },
            {
                "$inc": {"current_stock": -payload.quantity},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )

        if update_result.matched_count == 0:
            # Another concurrent transaction consumed stock between lookup and deduction
            refreshed = db.products.find_one(prod_query)
            current = refreshed.get("current_stock", 0) if refreshed else 0
            raise ValueError(
                f"Stock conflict: Inventory level changed concurrently. Current available: {current}"
            )

        # 4. Insert sales document
        sale_doc = {
            "product_id": product["_id"],
            "sku": product["sku"],
            "product_name": product["name"],
            "quantity": payload.quantity,
            "unit_price": unit_price,
            "total_amount": total_amount,
            "sale_date": sale_date,
            "idempotency_key": payload.idempotency_key
        }

        try:
            res = db.sales.insert_one(sale_doc)
            sale_doc["_id"] = res.inserted_id
        except DuplicateKeyError:
            # Duplicate transaction caught by unique index on idempotency_key
            # Compensate stock deduction
            db.products.update_one(
                {"_id": product["_id"]},
                {"$inc": {"current_stock": payload.quantity}}
            )
            existing = db.sales.find_one({"idempotency_key": payload.idempotency_key})
            return cls._doc_to_model(existing)
        except Exception as e:
            # Compensate stock deduction on unexpected DB write error
            db.products.update_one(
                {"_id": product["_id"]},
                {"$inc": {"current_stock": payload.quantity}}
            )
            raise e

        return cls._doc_to_model(sale_doc, product["name"])

    @classmethod
    def list_sales(
        cls,
        db: Database,
        page: int = 1,
        page_size: int = 20,
        product_id: Optional[str] = None,
        sku: Optional[str] = None
    ) -> Tuple[List[SaleOut], PaginationMeta]:
        query: Dict[str, Any] = {}

        if product_id:
            try:
                query["product_id"] = ObjectId(product_id)
            except Exception:
                query["product_id"] = product_id

        if sku:
            query["sku"] = sku.upper()

        total_count = db.sales.count_documents(query)
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        skip = (page - 1) * page_size

        cursor = db.sales.find(query).sort("sale_date", DESCENDING).skip(skip).limit(page_size)
        items = [cls._doc_to_model(doc) for doc in cursor]

        pagination = PaginationMeta(
            page=page,
            page_size=page_size,
            total_count=total_count,
            total_pages=total_pages
        )
        return items, pagination
