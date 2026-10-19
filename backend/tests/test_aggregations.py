"""
Unit & Integration Tests for MongoDB Aggregation Pipelines & Explain Benchmarks
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_dashboard_summary_aggregation():
    res = client.get("/api/analytics/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["total_products"] >= 0
    assert data["total_stock_units"] >= 0
    assert data["total_inventory_valuation"] >= 0.0


def test_revenue_trends_aggregation():
    res = client.get("/api/analytics/revenue-trends?days=30")
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    if items:
        first = items[0]
        assert "date" in first
        assert "revenue" in first
        assert "orders_count" in first
        assert "units_sold" in first


def test_category_performance_aggregation():
    res = client.get("/api/analytics/category-performance")
    assert res.status_code == 200
    categories = res.json()
    assert isinstance(categories, list)
    if categories:
        first = categories[0]
        assert "category" in first
        assert "total_revenue" in first
        assert "total_units_sold" in first
        assert "revenue_percentage" in first


def test_top_products_aggregation():
    res = client.get("/api/analytics/top-products?limit=5&days=90")
    assert res.status_code == 200
    prods = res.json()
    assert isinstance(prods, list)
    assert len(prods) <= 5
    if prods:
        first = prods[0]
        assert "product_id" in first
        assert "total_units_sold" in first


def test_explain_benchmark_execution():
    res = client.get("/api/performance/explain")
    assert res.status_code == 200
    data = res.json()
    assert "indexed_query_benchmark" in data
    assert "unindexed_query_benchmark" in data
    assert "indexes_by_collection" in data

    indexed = data["indexed_query_benchmark"]
    unindexed = data["unindexed_query_benchmark"]
    assert indexed["stage"] in ["IXSCAN", "FETCH", "PROJECTION_COVERED", "COLLSCAN", "EOF"]
    assert unindexed["stage"] == "COLLSCAN"
