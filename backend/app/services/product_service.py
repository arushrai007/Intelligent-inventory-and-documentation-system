"""
Product Service
CRUD operations, search, category filtering, stock alerting, and pagination using PyMongo.
"""

from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone
from bson import ObjectId
from pymongo.database import Database
from pymongo import ASCENDING, DESCENDING
from app.models.schemas import ProductCreate, ProductUpdate, ProductOut, PaginationMeta


class ProductService:
    @staticmethod
    def _doc_to_model(doc: Dict[str, Any], supplier_name: Optional[str] = None) -> ProductOut:
        return ProductOut(
            id=str(doc["_id"]),
            sku=doc["sku"],
            name=doc["name"],
            category=doc["category"],
            unit_price=float(doc["unit_price"]),
            cost_price=float(doc.get("cost_price", 0.0)),
            current_stock=int(doc["current_stock"]),
            reorder_threshold=int(doc["reorder_threshold"]),
            safety_stock=int(doc.get("safety_stock", 10)),
            supplier_id=str(doc.get("supplier_id")) if doc.get("supplier_id") else None,
            supplier_code=doc.get("supplier_code"),
            supplier_name=supplier_name or doc.get("supplier_name"),
            is_low_stock=doc["current_stock"] <= doc["reorder_threshold"],
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at")
        )

    @classmethod
    def list_products(
        cls,
        db: Database,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        category: Optional[str] = None,
        low_stock_only: bool = False,
        sort_by: str = "name",
        sort_order: str = "asc"
    ) -> Tuple[List[ProductOut], PaginationMeta]:
        query: Dict[str, Any] = {}

        if category and category.lower() != "all":
            query["category"] = category

        if low_stock_only:
            # Query documents where current_stock <= reorder_threshold using $expr
            query["$expr"] = {"$lte": ["$current_stock", "$reorder_threshold"]}

        if search and search.strip():
            # Support text search or regex on name/sku
            clean_search = search.strip()
            query["$or"] = [
                {"name": {"$regex": clean_search, "$options": "i"}},
                {"sku": {"$regex": clean_search, "$options": "i"}}
            ]

        # Sorting direction
        direction = ASCENDING if sort_order.lower() == "asc" else DESCENDING
        sort_field_map = {
            "name": "name",
            "sku": "sku",
            "price": "unit_price",
            "unit_price": "unit_price",
            "stock": "current_stock",
            "current_stock": "current_stock",
            "category": "category",
            "created_at": "created_at"
        }
        mongo_sort_field = sort_field_map.get(sort_by.lower(), "name")

        total_count = db.products.count_documents(query)
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        skip = (page - 1) * page_size

        # Aggregation with $lookup to embed supplier name
        pipeline = [
            {"$match": query},
            {"$sort": {mongo_sort_field: direction}},
            {"$skip": skip},
            {"$limit": page_size},
            {
                "$lookup": {
                    "from": "suppliers",
                    "let": {"sup_id": "$supplier_id"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$or": [
                                        {"$eq": ["$_id", "$$sup_id"]},
                                        {"$eq": [{"$toString": "$_id"}, "$$sup_id"]}
                                    ]
                                }
                            }
                        },
                        {"$project": {"name": 1}}
                    ],
                    "as": "supplier_info"
                }
            },
            {
                "$addFields": {
                    "supplier_name": {"$arrayElemAt": ["$supplier_info.name", 0]}
                }
            }
        ]

        cursor = db.products.aggregate(pipeline)
        items = [cls._doc_to_model(doc, doc.get("supplier_name")) for doc in cursor]

        pagination = PaginationMeta(
            page=page,
            page_size=page_size,
            total_count=total_count,
            total_pages=total_pages
        )
        return items, pagination

    @classmethod
    def get_by_id(cls, db: Database, product_id: str) -> Optional[ProductOut]:
        try:
            obj_id = ObjectId(product_id)
            doc = db.products.find_one({"_id": obj_id})
        except Exception:
            doc = db.products.find_one({"_id": product_id})

        if not doc:
            return None

        supplier_name = None
        if doc.get("supplier_id"):
            try:
                sup_id = ObjectId(doc["supplier_id"]) if isinstance(doc["supplier_id"], str) else doc["supplier_id"]
                sup = db.suppliers.find_one({"_id": sup_id}, {"name": 1})
                if sup:
                    supplier_name = sup.get("name")
            except Exception:
                pass

        return cls._doc_to_model(doc, supplier_name)

    @classmethod
    def get_by_sku(cls, db: Database, sku: str) -> Optional[ProductOut]:
        doc = db.products.find_one({"sku": sku.upper()})
        if not doc:
            return None
        return cls._doc_to_model(doc)

    @classmethod
    def create_product(cls, db: Database, payload: ProductCreate) -> ProductOut:
        # Check SKU uniqueness
        if db.products.find_one({"sku": payload.sku.upper()}):
            raise ValueError(f"Product with SKU '{payload.sku.upper()}' already exists.")

        now = datetime.now(timezone.utc)
        doc = {
            "sku": payload.sku.upper(),
            "name": payload.name,
            "category": payload.category,
            "unit_price": payload.unit_price,
            "cost_price": payload.cost_price,
            "current_stock": payload.current_stock,
            "reorder_threshold": payload.reorder_threshold,
            "safety_stock": payload.safety_stock,
            "supplier_id": ObjectId(payload.supplier_id) if payload.supplier_id else None,
            "supplier_code": payload.supplier_code,
            "created_at": now,
            "updated_at": now
        }
        res = db.products.insert_one(doc)
        doc["_id"] = res.inserted_id
        return cls._doc_to_model(doc)

    @classmethod
    def update_product(cls, db: Database, product_id: str, payload: ProductUpdate) -> Optional[ProductOut]:
        try:
            obj_id = ObjectId(product_id)
            query = {"_id": obj_id}
        except Exception:
            query = {"_id": product_id}

        existing = db.products.find_one(query)
        if not existing:
            return None

        update_fields: Dict[str, Any] = {}
        payload_dict = payload.model_dump(exclude_unset=True)

        for key, val in payload_dict.items():
            if key == "supplier_id":
                update_fields["supplier_id"] = ObjectId(val) if val else None
            else:
                update_fields[key] = val

        if update_fields:
            update_fields["updated_at"] = datetime.now(timezone.utc)
            db.products.update_one(query, {"$set": update_fields})

        return cls.get_by_id(db, product_id)

    @classmethod
    def delete_product(cls, db: Database, product_id: str) -> bool:
        try:
            obj_id = ObjectId(product_id)
            query = {"_id": obj_id}
        except Exception:
            query = {"_id": product_id}

        # Check references in sales or open purchase orders
        has_sales = db.sales.find_one({"product_id": {"$in": [obj_id, product_id]}})
        if has_sales:
            raise ValueError("Cannot delete product with existing sales history. Consider archiving or setting stock to 0.")

        res = db.products.delete_one(query)
        return res.deleted_count > 0
