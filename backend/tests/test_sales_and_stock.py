"""
Unit & Integration Tests for Sales Processing and Stock Consistency
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_sales_stock_deduction_and_overselling_protection():
    # 1. Create a controlled test product
    unique_sku = f"TX-{uuid.uuid4().hex[:6].upper()}"
    prod_res = client.post("/api/products", json={
        "sku": unique_sku,
        "name": "Controlled Inventory Item",
        "category": "Beverages",
        "unit_price": 10.0,
        "cost_price": 5.0,
        "current_stock": 25,
        "reorder_threshold": 10,
        "safety_stock": 5
    })
    assert prod_res.status_code == 201
    prod = prod_res.json()
    prod_id = prod["id"]

    # 2. Record valid sale of 10 units
    sale_payload = {
        "product_id": prod_id,
        "quantity": 10,
        "idempotency_key": f"tx-key-{uuid.uuid4().hex}"
    }
    sale_res = client.post("/api/sales", json=sale_payload)
    assert sale_res.status_code == 201
    sale_data = sale_res.json()
    assert sale_data["quantity"] == 10
    assert sale_data["total_amount"] == 100.0

    # 3. Verify stock decreased from 25 to 15
    check_res = client.get(f"/api/products/{prod_id}")
    assert check_res.status_code == 200
    assert check_res.json()["current_stock"] == 15

    # 4. Attempt to sell 20 units (exceeds current stock of 15)
    excess_sale_payload = {
        "product_id": prod_id,
        "quantity": 20,
        "idempotency_key": f"tx-key-{uuid.uuid4().hex}"
    }
    fail_res = client.post("/api/sales", json=excess_sale_payload)
    assert fail_res.status_code == 400
    assert "Insufficient stock" in fail_res.json()["detail"]

    # 5. Verify stock was NOT altered and remains 15
    check_res2 = client.get(f"/api/products/{prod_id}")
    assert check_res2.json()["current_stock"] == 15


def test_idempotent_duplicate_sale_prevention():
    # Create product
    unique_sku = f"IDEM-{uuid.uuid4().hex[:6].upper()}"
    prod_res = client.post("/api/products", json={
        "sku": unique_sku,
        "name": "Idempotency Test Item",
        "category": "Beverages",
        "unit_price": 20.0,
        "cost_price": 10.0,
        "current_stock": 50,
        "reorder_threshold": 10,
        "safety_stock": 5
    })
    prod_id = prod_res.json()["id"]

    shared_idempotency_key = f"fixed-uuid-{uuid.uuid4().hex}"
    payload = {
        "product_id": prod_id,
        "quantity": 5,
        "idempotency_key": shared_idempotency_key
    }

    # First attempt
    res1 = client.post("/api/sales", json=payload)
    assert res1.status_code == 201
    tx_id_1 = res1.json()["id"]

    # Immediate duplicate submission with identical key
    res2 = client.post("/api/sales", json=payload)
    assert res2.status_code in [200, 201]
    tx_id_2 = res2.json()["id"]

    # Both must reference the exact same transaction ID
    assert tx_id_1 == tx_id_2

    # Stock should have only decremented once (50 - 5 = 45, NOT 40)
    check_prod = client.get(f"/api/products/{prod_id}").json()
    assert check_prod["current_stock"] == 45
