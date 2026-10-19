"""
Unit & Integration Tests for scikit-learn Demand Forecasting
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_forecasting_with_sufficient_data():
    target_res = client.get("/api/products/sku/BEV-001")
    if target_res.status_code != 200:
        client.post("/api/system/seed?force=true")
        target_res = client.get("/api/products/sku/BEV-001")
    assert target_res.status_code == 200
    target_product = target_res.json()

    # Trigger 14-day forecast
    res = client.post("/api/forecasts/trigger", json={
        "product_id": target_product["id"],
        "horizon_days": 14,
        "algorithm": "random_forest"
    })
    assert res.status_code == 200
    forecasts = res.json()
    assert len(forecasts) == 1
    f = forecasts[0]

    assert f["product_id"] == target_product["id"]
    assert f["forecast_horizon_days"] == 14
    assert len(f["predictions"]) == 14
    assert f["is_fallback"] is False

    # Check evaluation metrics
    metrics = f["evaluation_metrics"]
    assert metrics is not None
    assert "mae" in metrics
    assert "rmse" in metrics
    assert metrics["mae"] >= 0.0
    assert metrics["rmse"] >= 0.0


def test_forecasting_fallback_on_sparse_data():
    # Create brand new product with zero sales
    new_sku = f"SPARSE-{uuid.uuid4().hex[:4].upper()}"
    prod_res = client.post("/api/products", json={
        "sku": new_sku,
        "name": "Zero Sales Sparse Product",
        "category": "Snacks",
        "unit_price": 5.0,
        "cost_price": 2.5,
        "current_stock": 20,
        "reorder_threshold": 10
    })
    prod_id = prod_res.json()["id"]

    # Trigger forecast
    res = client.post("/api/forecasts/trigger", json={
        "product_id": prod_id,
        "horizon_days": 7
    })
    assert res.status_code == 200
    f = res.json()[0]

    # Must transparently flag fallback
    assert f["is_fallback"] is True
    assert "Insufficient historical sales data" in f["fallback_reason"]
    assert len(f["predictions"]) == 7
