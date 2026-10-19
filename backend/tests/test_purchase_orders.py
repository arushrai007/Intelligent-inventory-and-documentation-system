"""
Unit & Integration Tests for Purchase Orders and Stock Receiving
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_purchase_order_lifecycle_and_idempotent_receiving():
    # 1. Ensure supplier exists
    sup_res = client.get("/api/suppliers")
    suppliers = sup_res.json()
    if not suppliers:
        sup_create = client.post("/api/suppliers", json={
            "supplier_code": f"SUP-{uuid.uuid4().hex[:4].upper()}",
            "name": "Integration Test Supplier",
            "contact_email": "test@supplier.com",
            "phone": "+1 (555) 000-1111",
            "lead_time_days": 5
        })
        supplier_id = sup_create.json()["id"]
    else:
        supplier_id = suppliers[0]["id"]

    # 2. Create product with initial stock 10
    sku = f"PO-{uuid.uuid4().hex[:5].upper()}"
    prod_res = client.post("/api/products", json={
        "sku": sku,
        "name": "PO Stock Test Item",
        "category": "Pantry Staples",
        "unit_price": 12.0,
        "cost_price": 6.0,
        "current_stock": 10,
        "reorder_threshold": 15,
        "safety_stock": 5,
        "supplier_id": supplier_id
    })
    prod = prod_res.json()
    prod_id = prod["id"]

    # 3. Create purchase order for 30 units
    po_payload = {
        "supplier_id": supplier_id,
        "items": [
            {
                "product_id": prod_id,
                "sku": sku,
                "product_name": prod["name"],
                "quantity": 30,
                "unit_cost": 6.0
            }
        ],
        "notes": "Test restock delivery"
    }
    po_res = client.post("/api/purchase-orders", json=po_payload)
    assert po_res.status_code == 201
    po = po_res.json()
    po_id = po["id"]
    assert po["status"] == "PENDING"

    # 4. Receive Purchase Order -> Stock must increment from 10 to 40
    rec_res = client.post(f"/api/purchase-orders/{po_id}/receive", json={"received_notes": "Delivered in full"})
    assert rec_res.status_code == 200
    updated_po = rec_res.json()
    assert updated_po["status"] == "RECEIVED"
    assert updated_po["received_at"] is not None

    # Check that product stock is now 40
    check_prod = client.get(f"/api/products/{prod_id}").json()
    assert check_prod["current_stock"] == 40

    # 5. Idempotency test: Re-submitting receive on same PO must fail
    dup_res = client.post(f"/api/purchase-orders/{po_id}/receive", json={"received_notes": "Duplicate receive"})
    assert dup_res.status_code == 400
    assert "Duplicate receipt blocked" in dup_res.json()["detail"] or "already been received" in dup_res.json()["detail"]

    # Verify stock remained 40 and was NOT double-incremented to 70
    check_prod_after = client.get(f"/api/products/{prod_id}").json()
    assert check_prod_after["current_stock"] == 40
