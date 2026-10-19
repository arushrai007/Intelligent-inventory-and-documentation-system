"""
Database Indexes Definition and Management
Creates indexes based on concrete application query patterns, avoiding redundant indexing.
"""

import logging
from pymongo import ASCENDING, DESCENDING, TEXT, IndexModel
from pymongo.database import Database

logger = logging.getLogger("inventory_system.db.indexes")


def ensure_indexes(db: Database):
    """
    Ensures all indexes exist on the target collections.
    """
    logger.info("Verifying and building MongoDB indexes...")

    # 1. Products Collection Indexes
    # - Unique SKU: prevents duplicate product records
    # - Category + Current Stock: accelerates category filtering & stock alerting
    # - Text search: enables fast keyword search on SKU and Name
    product_indexes = [
        IndexModel([("sku", ASCENDING)], unique=True, name="idx_products_sku_unique"),
        IndexModel([("category", ASCENDING), ("current_stock", ASCENDING)], name="idx_products_category_stock"),
        IndexModel([("current_stock", ASCENDING), ("reorder_threshold", ASCENDING)], name="idx_products_reorder_alert"),
        IndexModel([("supplier_id", ASCENDING)], name="idx_products_supplier_ref"),
        IndexModel([("name", TEXT), ("sku", TEXT)], name="idx_products_text_search")
    ]
    try:
        db.products.create_indexes(product_indexes)
        logger.info("Products indexes verified.")
    except Exception as e:
        logger.warning(f"Error creating product indexes: {e}")

    # 2. Sales Collection Indexes
    # - Compound Index: (product_id ASC, sale_date DESC) -> Crucial for time-series aggregation and ML feature generation
    # - Date index: For daily revenue & timeframe range queries
    # - Idempotency key: Unique index (sparse) to block duplicate transaction submissions
    sales_indexes = [
        IndexModel([("product_id", ASCENDING), ("sale_date", DESCENDING)], name="idx_sales_product_date_compound"),
        IndexModel([("sale_date", DESCENDING)], name="idx_sales_date_desc"),
        IndexModel([("idempotency_key", ASCENDING)], unique=True, sparse=True, name="idx_sales_idempotency_unique")
    ]
    try:
        db.sales.create_indexes(sales_indexes)
        logger.info("Sales indexes verified.")
    except Exception as e:
        logger.warning(f"Error creating sales indexes: {e}")

    # 3. Suppliers Collection Indexes
    # - Unique supplier code
    supplier_indexes = [
        IndexModel([("supplier_code", ASCENDING)], unique=True, name="idx_suppliers_code_unique"),
        IndexModel([("name", ASCENDING)], name="idx_suppliers_name")
    ]
    try:
        db.suppliers.create_indexes(supplier_indexes)
        logger.info("Suppliers indexes verified.")
    except Exception as e:
        logger.warning(f"Error creating supplier indexes: {e}")

    # 4. Purchase Orders Collection Indexes
    # - Unique PO number
    # - Compound Index: status + created_at DESC -> High frequency query for active POs dashboard
    po_indexes = [
        IndexModel([("po_number", ASCENDING)], unique=True, name="idx_po_number_unique"),
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="idx_po_status_date_compound"),
        IndexModel([("supplier_id", ASCENDING)], name="idx_po_supplier_ref")
    ]
    try:
        db.purchase_orders.create_indexes(po_indexes)
        logger.info("Purchase order indexes verified.")
    except Exception as e:
        logger.warning(f"Error creating purchase order indexes: {e}")

    # 5. Forecasts Collection Indexes
    # - Compound Index: product_id + generated_at DESC -> Quickly fetch latest prediction for product
    forecast_indexes = [
        IndexModel([("product_id", ASCENDING), ("generated_at", DESCENDING)], name="idx_forecasts_product_latest"),
        IndexModel([("generated_at", DESCENDING)], name="idx_forecasts_generated_desc")
    ]
    try:
        db.forecasts.create_indexes(forecast_indexes)
        logger.info("Forecasts indexes verified.")
    except Exception as e:
        logger.warning(f"Error creating forecast indexes: {e}")


def get_collection_indexes_info(db: Database):
    """
    Returns index information for all core collections to support the Database Performance page.
    """
    collections = ["products", "sales", "suppliers", "purchase_orders", "forecasts"]
    results = {}
    for col in collections:
        try:
            indexes = list(db[col].list_indexes())
            results[col] = [
                {
                    "name": idx.get("name"),
                    "key": list(idx.get("key", {}).items()),
                    "unique": idx.get("unique", False),
                    "sparse": idx.get("sparse", False)
                }
                for idx in indexes
            ]
        except Exception as e:
            results[col] = [{"error": str(e)}]
    return results
