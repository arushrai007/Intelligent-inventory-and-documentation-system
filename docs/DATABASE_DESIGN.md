# MongoDB Database Design & Data Modeling

This document details the MongoDB schema architecture, collection structures, embedding vs. referencing design decisions, relationship patterns, JSON Schema validation, and indexing strategies.

---

## 1. Embedding vs. Referencing Rationale

MongoDB provides flexibility in choosing between embedding sub-documents and referencing external collections. Our data model applies the following formal engineering criteria:

| Data Entity | Model Choice | Technical Rationale |
| :--- | :--- | :--- |
| **Purchase Order Line Items** | **Embedded** | Bounded cardinality (typically 1 to 20 items per order). Embedding preserves historical pricing at the time of purchase order creation and eliminates expensive joins during purchase order retrieval. |
| **Forecast Daily Predictions** | **Embedded** | Bounded array (7, 14, or 30 days). A forecast and its day-by-day projected values are always retrieved and visualized together as an atomic unit. |
| **Supplier Information** | **Referenced** | Independent entity with independent life cycle. Many products share the same supplier; updating supplier lead time or contact details must happen in one central document without updating thousands of product records. |
| **Product References in Sales** | **Referenced** | Unbounded cardinality. A product can have tens of thousands of sales transactions over time. Embedding sales inside products would violate the 16MB document size limit and cause performance degradation. |

---

## 2. Relationship Patterns

### 2.1 One-to-One (1:1) Example
- **System Settings Configuration:**
  - One global inventory policy document stored in `system_settings` representing business-wide constants:
    `{ "key": "inventory_policy", "safety_stock_z_score": 1.65, "default_lead_time_days": 7, ... }`

### 2.2 One-to-Many (1:N) Example
- **Supplier to Products (Referencing):**
  - One supplier supplies many products. Each document in the `products` collection stores a `supplier_id` reference:
    ```json
    {
      "_id": ObjectId("65f1a2b3c4d5e6f7a8b9c0d1"),
      "sku": "BEV-001",
      "name": "Cold Pressed Orange Juice (1L)",
      "supplier_id": ObjectId("65f1a2b3c4d5e6f7a8b9c001")
    }
    ```
- **Purchase Order to Line Items (Embedding):**
  - One purchase order embeds an array of line item snapshots:
    ```json
    {
      "_id": ObjectId("65f1a2b3c4d5e6f7a8b9c099"),
      "po_number": "PO-2026-0001",
      "items": [
        {
          "product_id": ObjectId("65f1a2b3c4d5e6f7a8b9c0d1"),
          "sku": "BEV-001",
          "quantity": 50,
          "unit_cost": 3.10
        }
      ]
    }
    ```

### 2.3 Many-to-Many (N:M) Example
- **Products and Purchase Orders:**
  - A purchase order can contain multiple distinct products, and a single product will appear across many purchase orders over time. This is implemented through referenced product identifiers within embedded purchase order item arrays.

---

## 3. Database Schema Specifications

### 3.1 `products` Collection
Stores master catalog items and current stock levels.
```json
{
  "_id": ObjectId("..."),
  "sku": "BEV-001",
  "name": "Cold Pressed Orange Juice (1L)",
  "category": "Beverages",
  "unit_price": 5.49,
  "cost_price": 3.10,
  "current_stock": 42,
  "reorder_threshold": 30,
  "safety_stock": 18,
  "supplier_id": ObjectId("..."),
  "supplier_code": "SUP-001",
  "created_at": ISODate("2026-04-10T00:00:00Z"),
  "updated_at": ISODate("2026-10-19T12:00:00Z")
}
```

### 3.2 `sales` Collection
Stores historical sales transactions.
```json
{
  "_id": ObjectId("..."),
  "product_id": ObjectId("..."),
  "sku": "BEV-001",
  "quantity": 14,
  "unit_price": 5.49,
  "total_amount": 76.86,
  "sale_date": ISODate("2026-10-18T14:32:00Z"),
  "idempotency_key": "tx-1729348320-xyz"
}
```

### 3.3 `suppliers` Collection
Stores vendor records and transit lead time parameters.
```json
{
  "_id": ObjectId("..."),
  "supplier_code": "SUP-001",
  "name": "Cascade Beverage Distributors",
  "contact_email": "orders@cascadebeverage.com",
  "phone": "+1 (555) 234-5678",
  "lead_time_days": 5,
  "lead_time_variance_days": 1.2,
  "active": true,
  "created_at": ISODate("2026-03-01T00:00:00Z"),
  "updated_at": ISODate("2026-10-01T00:00:00Z")
}
```

### 3.4 `purchase_orders` Collection
Tracks procurement status from recommendation to physical warehouse delivery.
```json
{
  "_id": ObjectId("..."),
  "po_number": "PO-2026-0001",
  "supplier_id": ObjectId("..."),
  "supplier_name": "Cascade Beverage Distributors",
  "status": "RECEIVED",
  "items": [
    {
      "product_id": ObjectId("..."),
      "sku": "BEV-001",
      "product_name": "Cold Pressed Orange Juice (1L)",
      "quantity": 50,
      "unit_cost": 3.10,
      "received_quantity": 50
    }
  ],
  "total_cost": 155.0,
  "created_at": ISODate("2026-10-01T10:00:00Z"),
  "expected_delivery_date": ISODate("2026-10-06T10:00:00Z"),
  "received_at": ISODate("2026-10-05T16:00:00Z"),
  "notes": "Delivered on time, restocked."
}
```

### 3.5 `forecasts` Collection
Stores machine learning outputs, confidence intervals, and evaluation metrics.
```json
{
  "_id": ObjectId("..."),
  "product_id": ObjectId("..."),
  "sku": "BEV-001",
  "model_name": "RandomForestRegressor",
  "model_version": "rf-v1.2.0",
  "forecast_horizon_days": 14,
  "generated_at": ISODate("2026-10-19T13:45:00Z"),
  "evaluation_metrics": {
    "mae": 1.84,
    "rmse": 2.31,
    "mape": 12.4,
    "baseline_mae": 2.45,
    "comparison_verdict": "Random Forest achieved 24.9% lower MAE compared to baseline."
  },
  "is_fallback": false,
  "historical_points_used": 180,
  "predictions": [
    {
      "date": "2026-10-20",
      "predicted_demand": 16.2,
      "lower_bound": 12.4,
      "upper_bound": 20.0
    }
  ]
}
```

---

## 4. Collection-Level JSON Schema Validation

Enforced on MongoDB Atlas collections via `db.command({ collMod: ... })`:
- **Quantity Non-Negativity:** `current_stock >= 0`, `quantity >= 1`.
- **Pricing Non-Negativity:** `unit_price >= 0`, `total_amount >= 0`.
- **SKU Format Enforcement:** Regular expression `^[A-Z0-9_-]{3,20}$`.
- **Supplier Code Enforcement:** Regular expression `^SUP-[A-Z0-9]{3,10}$`.
- **PO Status Enum Constraints:** Strict enum `["PENDING", "ORDERED", "RECEIVED", "CANCELLED"]`.

---

## 5. Indexing Architecture

Indexes were engineered to support high-frequency query patterns while avoiding redundant index maintenance overhead:

1. **`products.sku` (Unique Index):**
   - Pattern: High-frequency SKU lookup and uniqueness enforcement.
   - Index: `{"sku": 1}`, `unique: true`.
2. **`sales.(product_id, sale_date DESC)` (Compound Index):**
   - Pattern: Time-series historical demand extraction and aggregation for forecasting.
   - Index: `{"product_id": 1, "sale_date": -1}`.
3. **`sales.idempotency_key` (Unique Sparse Index):**
   - Pattern: Duplicate transaction prevention for retail POS requests.
   - Index: `{"idempotency_key": 1}`, `unique: true`, `sparse: true`.
4. **`purchase_orders.(status, created_at DESC)` (Compound Index):**
   - Pattern: Dashboard listing of active and pending purchase orders.
   - Index: `{"status": 1, "created_at": -1}`.
5. **`products.(name, sku)` (Text Index):**
   - Pattern: Free-text search in the product catalog.
   - Index: `{"name": "text", "sku": "text"}`.
