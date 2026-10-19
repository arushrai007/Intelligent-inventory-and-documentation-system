"""
Unit & Integration Tests for Product Management
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "version" in data


def test_create_and_get_product():
    test_sku = "TEST-PRD-99"
    payload = {
        "sku": test_sku,
        "name": "Test Whole Grain Bread",
        "category": "Pantry Staples",
        "unit_price": 3.99,
        "cost_price": 1.80,
        "current_stock": 50,
        "reorder_threshold": 20,
        "safety_stock": 10
    }

    # 1. Create Product
    create_res = client.post("/api/products", json=payload)
    if create_res.status_code == 400 and "already exists" in create_res.text:
        # Pre-existing from previous run
        pass
    else:
        assert create_res.status_code in [201, 200]
        created = create_res.json()
        assert created["sku"] == test_sku
        assert created["name"] == payload["name"]
        assert created["current_stock"] == 50

    # 2. Get Product by SKU
    get_res = client.get(f"/api/products/sku/{test_sku}")
    assert get_res.status_code == 200
    prod = get_res.json()
    assert prod["sku"] == test_sku

    # 3. Validation: Reject Negative Price
    invalid_payload = payload.copy()
    invalid_payload["sku"] = "TEST-NEG-01"
    invalid_payload["unit_price"] = -5.0
    bad_res = client.post("/api/products", json=invalid_payload)
    assert bad_res.status_code == 422  # Pydantic validation failure


def test_product_search_and_pagination():
    response = client.get("/api/products?page=1&page_size=5&search=Milk")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "pagination" in data
    assert data["pagination"]["page"] == 1
    assert data["pagination"]["page_size"] == 5
