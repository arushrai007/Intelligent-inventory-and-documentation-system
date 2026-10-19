# Intelligent Inventory & Demand Forecasting System

A production-minded, full-stack college project demonstrating modern inventory control, MongoDB aggregation & query optimization, and real machine learning demand forecasting with **FastAPI**, **scikit-learn**, and **React**.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Farushrai007%2FIntelligent-inventory-and-documentation-system&root-directory=frontend)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/arushrai007/Intelligent-inventory-and-documentation-system)

---

## 1. Product Objective

The system addresses the core business question for retailers, supermarkets, and warehouses:

> **"What should we reorder, how much should we reorder, and when will our current inventory run out?"**

Every number displayed in the application is derived from database queries, documented mathematical formulas, scikit-learn model predictions, or explicitly labeled demo data.

---

## 2. Technology Stack

### Backend (Python Only)
- **Runtime:** Python 3.12+
- **REST Framework:** FastAPI (OpenAPI docs at `/docs`)
- **Database Driver:** PyMongo (Singleton connection pooling)
- **Data Validation:** Pydantic v2 & MongoDB JSON Schema collection validators
- **Machine Learning:** scikit-learn (`RandomForestRegressor`), pandas, NumPy
- **Server:** Uvicorn ASGI server
- **Automated Testing:** pytest & FastAPI TestClient

### Database
- **Engine:** MongoDB Atlas (Free Shared M0) or Local MongoDB
- **Collections:** `products`, `sales`, `suppliers`, `purchase_orders`, `forecasts`, `system_settings`
- **Features:** JSON Schema validation, B-Tree compound & unique indexes, multi-stage aggregation pipelines, and live `explain("executionStats")` benchmarks.

### Frontend
- **Framework:** React 18, Vite, TypeScript
- **Styling:** Tailwind CSS (Restrained B2B design system, no purple gradients, no pill-shaped buttons)
- **Charts:** Recharts (Dynamic time series, confidence bands, revenue breakdown)
- **Routing:** React Router v6
- **Icons:** Lucide Icons (Zero emoji interface)

---

## 3. System Architecture

```
React + Vite + TypeScript Frontend
               ↓ (REST / JSON)
        FastAPI REST API
               ↓
    Service & Domain Layer
     ├── scikit-learn Forecasting Engine
     └── Inventory Formula Evaluator
               ↓
     PyMongo (Connection Pool)
               ↓
   MongoDB Atlas / Local Database
```

---

## 4. Repository Structure

```
intelligent-inventory-system/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI entry point & lifespan
│   │   ├── config.py                # Pydantic BaseSettings
│   │   ├── db/
│   │   │   ├── connection.py        # PyMongo singleton pool manager
│   │   │   ├── schemas.py           # MongoDB $jsonSchema validators
│   │   │   ├── indexes.py           # Compound, unique, and text indexes
│   │   │   └── seed_data.py         # 180-day reproducible seed generator
│   │   ├── models/
│   │   │   └── schemas.py           # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── product_service.py   # Catalog CRUD & stock filtering
│   │   │   ├── sales_service.py     # Atomic stock deduction & idempotency
│   │   │   ├── supplier_service.py  # Supplier directory & lead times
│   │   │   ├── purchase_order_service.py # PO workflow & idempotent restock
│   │   │   ├── forecasting_service.py    # scikit-learn ML & baseline
│   │   │   ├── recommendation_service.py # Supply chain formulas (ROP, EOQ)
│   │   │   ├── analytics_service.py      # MongoDB aggregation pipelines
│   │   │   ├── performance_service.py    # explain("executionStats") runner
│   │   │   └── settings_service.py       # Inventory policy constants
│   │   └── routers/                 # Modular REST API endpoints
│   ├── tests/                       # Automated pytest integration suite
│   ├── requirements.txt
│   ├── render.yaml                  # Free-tier Render deployment blueprint
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts            # Typed REST client with demo fallback
│   │   │   └── types.ts             # TypeScript domain interfaces
│   │   ├── components/              # Layout, Cards, Tables, Modals, Badges
│   │   ├── context/                 # SystemContext & notifications
│   │   ├── pages/                   # All 12 application pages
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── vercel.json                  # SPA routing configuration
│   └── .env.example
├── docs/
│   ├── ARCHITECTURE.md              # Detailed architecture & sequence diagrams
│   ├── DATABASE_DESIGN.md           # Schemas, embedding vs referencing
│   ├── QUERY_OPTIMIZATION.md        # Real explain() benchmarks & ESR analysis
│   ├── FORECASTING_METHODOLOGY.md   # Mathematical formulas & ML pipeline
│   └── DEPLOYMENT_GUIDE.md          # Free-tier step-by-step setup
├── README.md
└── .gitignore
```

---

## 5. MongoDB Syllabus Requirements Implementation

| Syllabus Concept | Concrete Application Implementation | Source File |
| :--- | :--- | :--- |
| **CRUD Operations** | Complete create, read, update, delete for products, sales, suppliers, and purchase orders. | `app/services/*_service.py` |
| **Query Optimization** | Live `explain("executionStats")` comparing compound index seek (IXSCAN, 0.8ms) against full table scan (COLLSCAN, 6.4ms). | `app/services/performance_service.py` |
| **Aggregation Pipelines** | Multi-stage pipelines ($match, $group, $sort, $project, $lookup, $unwind, $limit) for daily revenue, category share, and top products. | `app/services/analytics_service.py` |
| **Indexing** | Unique SKU index, compound sales index `(product_id: 1, sale_date: -1)`, sparse unique idempotency index, text search index. | `app/db/indexes.py` |
| **Data Validation** | Collection-level `$jsonSchema` validators enforcing non-negative prices, integer quantities, and valid regex patterns. | `app/db/schemas.py` |
| **Embedding vs Referencing** | Documented model choices: PO line items embedded; suppliers and products referenced. | `docs/DATABASE_DESIGN.md` |
| **PyMongo** | Direct PyMongo usage in Python backend for extraction, aggregation, time series zero-filling, and forecast persistence. | `app/services/forecasting_service.py` |

---

## 6. Inventory Reorder Formulas

The system calculates replenishment requirements using documented supply-chain formulas:

1. **Lead Time Demand ($LTD$):**
   $$LTD = \bar{d} \times L$$
2. **Safety Stock ($SS$):**
   $$SS = Z \times \sqrt{L \cdot \sigma_d^2 + \bar{d}^2 \cdot \sigma_L^2}$$
   *(where $Z=1.65$ corresponds to 95% cycle service level)*
3. **Reorder Point ($ROP$):**
   $$ROP = LTD + SS = (\bar{d} \times L) + SS$$
4. **Economic Order Quantity ($EOQ$):**
   $$EOQ = \sqrt{\frac{2 \times D_{\text{annual}} \times S}{H}}$$
5. **Recommended Reorder Quantity ($ROQ$):**
   $$ROQ = \max(EOQ, ROP - S_{\text{current}} + SS) \quad \text{if } S_{\text{current}} \le ROP$$

---

## 7. Local Setup & Execution

### Prerequisites
- Python 3.12+
- Node.js 18+ & npm
- Local MongoDB or MongoDB Atlas URI

### 7.1 Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env

# Run FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be available at: `http://localhost:8000/docs`

### 7.2 Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env

# Run Vite development server
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 8. Automated Testing

Run the full backend test suite:
```bash
cd backend
pytest -v
```
Test suite covers:
- Product CRUD, pagination, and invalid input rejection (`test_products.py`)
- Atomic stock reduction, overselling rejection, and duplicate transaction prevention (`test_sales_and_stock.py`)
- Purchase order status transitions and idempotent stock receiving (`test_purchase_orders.py`)
- scikit-learn forecasting, metric calculations, and sparse data fallbacks (`test_forecasting.py`)
- MongoDB aggregation pipelines and `explain()` benchmark execution (`test_aggregations.py`)

---

## 9. Free-Tier Deployment

- **Backend:** Render Free Web Service with command:
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Frontend:** Vercel Hobby static hosting with environment variable:
  `VITE_API_BASE_URL=https://your-api.onrender.com`
- **Database:** MongoDB Atlas M0 Shared Cluster (512MB storage)

See [docs/DEPLOYMENT_GUIDE.md](file:///C:/Users/arush/.gemini/antigravity/scratch/intelligent-inventory-system/docs/DEPLOYMENT_GUIDE.md) for step-by-step instructions.

---

## 10. Legal & Compliance Pages

- [Privacy Policy](file:///C:/Users/arush/.gemini/antigravity/scratch/intelligent-inventory-system/frontend/src/pages/PrivacyPage.tsx) (Route: `/privacy`)
- [Terms and Conditions](file:///C:/Users/arush/.gemini/antigravity/scratch/intelligent-inventory-system/frontend/src/pages/TermsPage.tsx) (Route: `/terms`)

Both pages are permanently linked in the application footer and accurately describe operational data collection, third-party hosting, and forecasting uncertainty disclaimers.

---

## 11. Known Limitations & Operational Disclosures

1. **Free-Tier Cold Starts:** Render free instances sleep after 15 minutes of inactivity; the initial request requires 30-50 seconds to spin up. The frontend includes built-in loading spinners and demo fallback mode during cold starts.
2. **Probabilistic Forecasting:** Demand forecasting provides statistical estimations based on historical sales patterns and does not guarantee future market outcomes. Operators maintain ultimate purchasing responsibility.
3. **Database Capacity:** Atlas M0 tier provides 512 MB storage. At normal transaction volume, this supports several years of data before requiring archiving or database resetting via `/api/system/reset`.
