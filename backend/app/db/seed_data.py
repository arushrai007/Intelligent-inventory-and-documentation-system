"""
Reproducible Seed Data Generator
Generates realistic inventory, supplier, sales (180 days of continuous data),
and purchase orders for realistic machine learning model training and testing.
"""

import random
import logging
from datetime import datetime, timedelta, timezone
from pymongo.database import Database

logger = logging.getLogger("inventory_system.db.seed")

# Fix random seed for reproducibility
RANDOM_SEED = 42
random.seed(RANDOM_SEED)

SUPPLIERS_SEED = [
    {
        "supplier_code": "SUP-001",
        "name": "Cascade Beverage Distributors",
        "contact_email": "orders@cascadebeverage.com",
        "phone": "+1 (555) 234-5678",
        "lead_time_days": 5,
        "lead_time_variance_days": 1.2,
        "active": True
    },
    {
        "supplier_code": "SUP-002",
        "name": "Sunrise Dairy & Farm Co.",
        "contact_email": "logistics@sunrisedairy.com",
        "phone": "+1 (555) 345-6789",
        "lead_time_days": 3,
        "lead_time_variance_days": 0.8,
        "active": True
    },
    {
        "supplier_code": "SUP-003",
        "name": "Golden Grain Milling Co.",
        "contact_email": "wholesale@goldengrain.com",
        "phone": "+1 (555) 456-7890",
        "lead_time_days": 10,
        "lead_time_variance_days": 2.1,
        "active": True
    },
    {
        "supplier_code": "SUP-004",
        "name": "Apex Snack & Confectionery",
        "contact_email": "supply@apexsnacks.com",
        "phone": "+1 (555) 567-8901",
        "lead_time_days": 7,
        "lead_time_variance_days": 1.5,
        "active": True
    },
    {
        "supplier_code": "SUP-005",
        "name": "Valley Organic Provisions",
        "contact_email": "accounts@valleyorganics.com",
        "phone": "+1 (555) 678-9012",
        "lead_time_days": 6,
        "lead_time_variance_days": 1.0,
        "active": True
    }
]

PRODUCTS_SEED = [
    # Beverages (SUP-001)
    {"sku": "BEV-001", "name": "Cold Pressed Orange Juice (1L)", "category": "Beverages", "unit_price": 5.49, "cost_price": 3.10, "current_stock": 42, "reorder_threshold": 30, "safety_stock": 18, "supplier_code": "SUP-001", "base_daily_sales": 14},
    {"sku": "BEV-002", "name": "Organic Oat Milk Barista (1L)", "category": "Beverages", "unit_price": 4.29, "cost_price": 2.40, "current_stock": 25, "reorder_threshold": 35, "safety_stock": 20, "supplier_code": "SUP-001", "base_daily_sales": 18},
    {"sku": "BEV-003", "name": "Sparkling Mineral Water (750ml)", "category": "Beverages", "unit_price": 2.99, "cost_price": 1.20, "current_stock": 110, "reorder_threshold": 50, "safety_stock": 25, "supplier_code": "SUP-001", "base_daily_sales": 22},
    {"sku": "BEV-004", "name": "Artisan Cold Brew Coffee (330ml)", "category": "Beverages", "unit_price": 3.99, "cost_price": 1.85, "current_stock": 18, "reorder_threshold": 25, "safety_stock": 15, "supplier_code": "SUP-001", "base_daily_sales": 12},

    # Dairy & Fresh (SUP-002)
    {"sku": "DAI-001", "name": "Whole Farm Milk (2L)", "category": "Dairy & Fresh", "unit_price": 3.89, "cost_price": 2.10, "current_stock": 65, "reorder_threshold": 40, "safety_stock": 22, "supplier_code": "SUP-002", "base_daily_sales": 26},
    {"sku": "DAI-002", "name": "Greek Plain Yogurt (500g)", "category": "Dairy & Fresh", "unit_price": 4.49, "cost_price": 2.30, "current_stock": 34, "reorder_threshold": 25, "safety_stock": 14, "supplier_code": "SUP-002", "base_daily_sales": 15},
    {"sku": "DAI-003", "name": "Aged Sharp Cheddar Block (250g)", "category": "Dairy & Fresh", "unit_price": 6.99, "cost_price": 4.10, "current_stock": 28, "reorder_threshold": 20, "safety_stock": 12, "supplier_code": "SUP-002", "base_daily_sales": 9},
    {"sku": "DAI-004", "name": "Salted Farmhouse Butter (250g)", "category": "Dairy & Fresh", "unit_price": 4.79, "cost_price": 2.80, "current_stock": 19, "reorder_threshold": 30, "safety_stock": 16, "supplier_code": "SUP-002", "base_daily_sales": 16},

    # Pantry Staples (SUP-003)
    {"sku": "PAN-001", "name": "Organic Rolled Oats (1kg)", "category": "Pantry Staples", "unit_price": 4.99, "cost_price": 2.20, "current_stock": 58, "reorder_threshold": 35, "safety_stock": 18, "supplier_code": "SUP-003", "base_daily_sales": 11},
    {"sku": "PAN-002", "name": "Stoneground Whole Wheat Flour (2kg)", "category": "Pantry Staples", "unit_price": 5.79, "cost_price": 2.90, "current_stock": 31, "reorder_threshold": 25, "safety_stock": 15, "supplier_code": "SUP-003", "base_daily_sales": 8},
    {"sku": "PAN-003", "name": "Jasmine Fragrant Rice (5kg)", "category": "Pantry Staples", "unit_price": 14.99, "cost_price": 8.50, "current_stock": 14, "reorder_threshold": 20, "safety_stock": 10, "supplier_code": "SUP-003", "base_daily_sales": 7},
    {"sku": "PAN-004", "name": "Bronze-Cut Spaghetti Pasta (500g)", "category": "Pantry Staples", "unit_price": 2.79, "cost_price": 1.10, "current_stock": 85, "reorder_threshold": 45, "safety_stock": 20, "supplier_code": "SUP-003", "base_daily_sales": 19},

    # Snacks & Confectionery (SUP-004)
    {"sku": "SNK-001", "name": "Sea Salt Kettle Chips (150g)", "category": "Snacks", "unit_price": 3.49, "cost_price": 1.50, "current_stock": 72, "reorder_threshold": 40, "safety_stock": 20, "supplier_code": "SUP-004", "base_daily_sales": 24},
    {"sku": "SNK-002", "name": "Dark Chocolate Sea Salt Bar (85g)", "category": "Snacks", "unit_price": 3.99, "cost_price": 1.90, "current_stock": 46, "reorder_threshold": 30, "safety_stock": 15, "supplier_code": "SUP-004", "base_daily_sales": 13},
    {"sku": "SNK-003", "name": "Roasted Almonds & Cranberry Mix (200g)", "category": "Snacks", "unit_price": 6.49, "cost_price": 3.60, "current_stock": 22, "reorder_threshold": 25, "safety_stock": 12, "supplier_code": "SUP-004", "base_daily_sales": 10},
    {"sku": "SNK-004", "name": "Baked Pita Bites Herb Garlic (180g)", "category": "Snacks", "unit_price": 3.69, "cost_price": 1.60, "current_stock": 38, "reorder_threshold": 30, "safety_stock": 14, "supplier_code": "SUP-004", "base_daily_sales": 11},

    # Organic Provisions (SUP-005)
    {"sku": "ORG-001", "name": "Raw Wildflower Honey (500g)", "category": "Pantry Staples", "unit_price": 8.99, "cost_price": 4.80, "current_stock": 15, "reorder_threshold": 20, "safety_stock": 10, "supplier_code": "SUP-005", "base_daily_sales": 6},
    {"sku": "ORG-002", "name": "Cold Pressed Extra Virgin Olive Oil (500ml)", "category": "Pantry Staples", "unit_price": 11.49, "cost_price": 6.20, "current_stock": 12, "reorder_threshold": 18, "safety_stock": 8, "supplier_code": "SUP-005", "base_daily_sales": 7},
    {"sku": "ORG-003", "name": "Organic Chia Seeds (400g)", "category": "Pantry Staples", "unit_price": 5.99, "cost_price": 2.90, "current_stock": 29, "reorder_threshold": 22, "safety_stock": 10, "supplier_code": "SUP-005", "base_daily_sales": 5},
    {"sku": "ORG-004", "name": "Organic Fair-Trade Green Tea (50 bags)", "category": "Beverages", "unit_price": 6.29, "cost_price": 3.10, "current_stock": 33, "reorder_threshold": 25, "safety_stock": 12, "supplier_code": "SUP-005", "base_daily_sales": 8}
]


def seed_database(db: Database, force: bool = False):
    """
    Populates database with suppliers, products, historical sales (180 days),
    and purchase orders. If force is False and products exist, skips seeding.
    """
    existing_count = db.products.count_documents({})
    if existing_count > 0 and not force:
        logger.info(f"Database already populated ({existing_count} products found). Skipping seed.")
        return {"status": "skipped", "message": f"Database already contains {existing_count} products."}

    logger.info("Starting database seed process...")
    random.seed(RANDOM_SEED)

    # 1. Clean collections if force=True
    if force:
        db.products.delete_many({})
        db.suppliers.delete_many({})
        db.sales.delete_many({})
        db.purchase_orders.delete_many({})
        db.forecasts.delete_many({})
        db.system_settings.delete_many({})
        logger.info("Cleared existing collections for clean seed.")

    # 2. Insert Suppliers
    supplier_map = {}
    for sup in SUPPLIERS_SEED:
        sup_data = sup.copy()
        sup_data["created_at"] = datetime.now(timezone.utc) - timedelta(days=200)
        sup_data["updated_at"] = datetime.now(timezone.utc) - timedelta(days=200)
        res = db.suppliers.insert_one(sup_data)
        supplier_map[sup["supplier_code"]] = res.inserted_id

    # 3. Insert Products
    product_map = {}
    product_docs = []
    base_sales_map = {}

    for prod in PRODUCTS_SEED:
        doc = {
            "sku": prod["sku"],
            "name": prod["name"],
            "category": prod["category"],
            "unit_price": prod["unit_price"],
            "cost_price": prod["cost_price"],
            "current_stock": prod["current_stock"],
            "reorder_threshold": prod["reorder_threshold"],
            "safety_stock": prod["safety_stock"],
            "supplier_id": supplier_map.get(prod["supplier_code"]),
            "supplier_code": prod["supplier_code"],
            "created_at": datetime.now(timezone.utc) - timedelta(days=190),
            "updated_at": datetime.now(timezone.utc) - timedelta(days=10)
        }
        res = db.products.insert_one(doc)
        product_map[prod["sku"]] = res.inserted_id
        base_sales_map[prod["sku"]] = prod["base_daily_sales"]

    # 4. Generate 180 Days of Continuous Historical Sales
    # Includes weekend boost (Fri/Sat/Sun), slight monthly variance, and realistic noise
    now = datetime.now(timezone.utc)
    sales_docs = []

    for day_offset in range(180, 0, -1):
        target_date = (now - timedelta(days=day_offset)).replace(hour=12, minute=0, second=0, microsecond=0)
        day_of_week = target_date.weekday()  # 0=Monday, 6=Sunday
        is_weekend = day_of_week in [4, 5, 6]  # Fri, Sat, Sun
        weekend_multiplier = 1.35 if is_weekend else 1.0

        for prod in PRODUCTS_SEED:
            sku = prod["sku"]
            prod_id = product_map[sku]
            base_sales = base_sales_map[sku]

            # Upward trend over 180 days: (0.9 to 1.15)
            trend_factor = 0.90 + (0.25 * ((180 - day_offset) / 180.0))

            # Random variance with Poisson-like / Gaussian noise
            expected_mean = base_sales * weekend_multiplier * trend_factor
            actual_quantity = max(1, int(random.gauss(expected_mean, max(1.5, expected_mean * 0.22))))

            # Split into 1 to 3 customer transaction records throughout the day
            chunks = random.choice([1, 2, 3])
            remaining = actual_quantity
            for c in range(chunks):
                if remaining <= 0:
                    break
                qty = remaining if c == chunks - 1 else max(1, int(remaining / (chunks - c)))
                remaining -= qty

                sale_time = target_date.replace(
                    hour=random.randint(9, 20),
                    minute=random.randint(0, 59),
                    second=random.randint(0, 59)
                )

                total_amount = round(qty * prod["unit_price"], 2)
                idempotency_key = f"seed-tx-{sku}-{day_offset}-{c}"

                sales_docs.append({
                    "product_id": prod_id,
                    "sku": sku,
                    "quantity": qty,
                    "unit_price": prod["unit_price"],
                    "total_amount": total_amount,
                    "sale_date": sale_time,
                    "idempotency_key": idempotency_key
                })

    # Bulk insert sales in chunks of 1000
    if sales_docs:
        chunk_size = 1000
        for i in range(0, len(sales_docs), chunk_size):
            db.sales.insert_many(sales_docs[i:i + chunk_size])

    # 5. Insert Sample Purchase Orders
    po_docs = [
        {
            "po_number": "PO-2026-0001",
            "supplier_id": supplier_map.get("SUP-001"),
            "status": "RECEIVED",
            "items": [
                {
                    "product_id": product_map["BEV-001"],
                    "sku": "BEV-001",
                    "product_name": "Cold Pressed Orange Juice (1L)",
                    "quantity": 50,
                    "unit_cost": 3.10,
                    "received_quantity": 50
                },
                {
                    "product_id": product_map["BEV-002"],
                    "sku": "BEV-002",
                    "product_name": "Organic Oat Milk Barista (1L)",
                    "quantity": 40,
                    "unit_cost": 2.40,
                    "received_quantity": 40
                }
            ],
            "total_cost": 251.0,
            "created_at": now - timedelta(days=25),
            "expected_delivery_date": now - timedelta(days=20),
            "received_at": now - timedelta(days=19),
            "notes": "Regular restock delivery received on time."
        },
        {
            "po_number": "PO-2026-0002",
            "supplier_id": supplier_map.get("SUP-003"),
            "status": "ORDERED",
            "items": [
                {
                    "product_id": product_map["PAN-003"],
                    "sku": "PAN-003",
                    "product_name": "Jasmine Fragrant Rice (5kg)",
                    "quantity": 30,
                    "unit_cost": 8.50,
                    "received_quantity": 0
                }
            ],
            "total_cost": 255.0,
            "created_at": now - timedelta(days=3),
            "expected_delivery_date": now + timedelta(days=7),
            "received_at": None,
            "notes": "Low stock replenishment order in transit."
        },
        {
            "po_number": "PO-2026-0003",
            "supplier_id": supplier_map.get("SUP-004"),
            "status": "PENDING",
            "items": [
                {
                    "product_id": product_map["SNK-003"],
                    "sku": "SNK-003",
                    "product_name": "Roasted Almonds & Cranberry Mix (200g)",
                    "quantity": 25,
                    "unit_cost": 3.60,
                    "received_quantity": 0
                }
            ],
            "total_cost": 90.0,
            "created_at": now - timedelta(hours=8),
            "expected_delivery_date": now + timedelta(days=6),
            "received_at": None,
            "notes": "Generated from automated reorder recommendation."
        }
    ]
    db.purchase_orders.insert_many(po_docs)

    # 6. Default System Settings
    settings_doc = {
        "key": "inventory_policy",
        "default_lead_time_days": 7,
        "safety_stock_z_score": 1.65,  # 95% service level
        "annual_holding_cost_rate": 0.20,
        "fixed_order_cost": 50.0,
        "forecast_horizon_days": 14,
        "auto_reorder_enabled": False,
        "updated_at": now
    }
    db.system_settings.update_one({"key": "inventory_policy"}, {"$set": settings_doc}, upsert=True)

    summary = {
        "status": "success",
        "suppliers_seeded": len(SUPPLIERS_SEED),
        "products_seeded": len(PRODUCTS_SEED),
        "sales_records_seeded": len(sales_docs),
        "purchase_orders_seeded": len(po_docs),
        "date_range_days": 180
    }
    logger.info(f"Database seed complete: {summary}")
    return summary
