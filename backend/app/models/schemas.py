"""
Pydantic Schemas for Request & Response Data Validation
"""

from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, EmailStr, ConfigDict


# -------------------------------------------------------------
# Common & Pagination Models
# -------------------------------------------------------------

class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total_count: int
    total_pages: int


class MessageResponse(BaseModel):
    status: str
    message: str
    data: Optional[Dict[str, Any]] = None


# -------------------------------------------------------------
# Product Schemas
# -------------------------------------------------------------

class ProductBase(BaseModel):
    sku: str = Field(..., min_length=3, max_length=20, pattern=r"^[A-Z0-9_-]{3,20}$", description="Uppercase SKU code")
    name: str = Field(..., min_length=2, max_length=100)
    category: str = Field(..., min_length=2, max_length=50)
    unit_price: float = Field(..., ge=0.01, description="Selling price per unit")
    cost_price: float = Field(..., ge=0.0, description="Acquisition cost")
    current_stock: int = Field(..., ge=0, description="On-hand stock quantity")
    reorder_threshold: int = Field(..., ge=0, description="Stock level triggering reorder")
    safety_stock: int = Field(default=10, ge=0, description="Buffer stock for demand variance")
    supplier_id: Optional[str] = Field(default=None, description="Referenced Supplier ObjectId as string")
    supplier_code: Optional[str] = Field(default=None, description="Supplier code for convenience")


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    category: Optional[str] = Field(default=None, min_length=2, max_length=50)
    unit_price: Optional[float] = Field(default=None, ge=0.01)
    cost_price: Optional[float] = Field(default=None, ge=0.0)
    current_stock: Optional[int] = Field(default=None, ge=0)
    reorder_threshold: Optional[int] = Field(default=None, ge=0)
    safety_stock: Optional[int] = Field(default=None, ge=0)
    supplier_id: Optional[str] = None
    supplier_code: Optional[str] = None


class ProductOut(ProductBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    supplier_name: Optional[str] = None
    is_low_stock: bool = False

    model_config = ConfigDict(populate_by_name=True)


class PaginatedProductsResponse(BaseModel):
    items: List[ProductOut]
    pagination: PaginationMeta


# -------------------------------------------------------------
# Sales Schemas
# -------------------------------------------------------------

class SaleCreate(BaseModel):
    product_id: str
    quantity: int = Field(..., ge=1, description="Number of units sold")
    unit_price: Optional[float] = Field(default=None, ge=0.0, description="Optional override, defaults to product unit_price")
    sale_date: Optional[datetime] = Field(default=None, description="Defaults to current timestamp")
    idempotency_key: Optional[str] = Field(default=None, description="Unique client token to prevent duplicate charges")


class SaleOut(BaseModel):
    id: str
    product_id: str
    sku: str
    product_name: Optional[str] = None
    quantity: int
    unit_price: float
    total_amount: float
    sale_date: datetime
    idempotency_key: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class PaginatedSalesResponse(BaseModel):
    items: List[SaleOut]
    pagination: PaginationMeta


# -------------------------------------------------------------
# Supplier Schemas
# -------------------------------------------------------------

class SupplierBase(BaseModel):
    supplier_code: str = Field(..., pattern=r"^SUP-[A-Z0-9]{3,10}$", description="Supplier code, e.g. SUP-001")
    name: str = Field(..., min_length=2, max_length=100)
    contact_email: EmailStr
    phone: str = Field(..., min_length=7, max_length=25)
    lead_time_days: int = Field(..., ge=1, le=120, description="Average transit lead time in days")
    lead_time_variance_days: float = Field(default=1.0, ge=0.0, description="Standard deviation of lead time in days")
    active: bool = True


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    lead_time_days: Optional[int] = Field(default=None, ge=1, le=120)
    lead_time_variance_days: Optional[float] = Field(default=None, ge=0.0)
    active: Optional[bool] = None


class SupplierOut(SupplierBase):
    id: str
    product_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)


# -------------------------------------------------------------
# Purchase Order Schemas
# -------------------------------------------------------------

class POStatusEnum(str, Enum):
    PENDING = "PENDING"
    ORDERED = "ORDERED"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"


class PurchaseOrderItem(BaseModel):
    product_id: str
    sku: str
    product_name: str
    quantity: int = Field(..., ge=1)
    unit_cost: float = Field(..., ge=0.0)
    received_quantity: int = Field(default=0, ge=0)


class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    items: List[PurchaseOrderItem] = Field(..., min_length=1)
    expected_delivery_date: Optional[datetime] = None
    notes: Optional[str] = None


class PurchaseOrderReceiveRequest(BaseModel):
    received_notes: Optional[str] = None


class PurchaseOrderOut(BaseModel):
    id: str
    po_number: str
    supplier_id: str
    supplier_name: Optional[str] = None
    status: POStatusEnum
    items: List[PurchaseOrderItem]
    total_cost: float
    created_at: datetime
    expected_delivery_date: Optional[datetime] = None
    received_at: Optional[datetime] = None
    notes: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


# -------------------------------------------------------------
# Forecast & Demand Models
# -------------------------------------------------------------

class DailyPrediction(BaseModel):
    date: str  # YYYY-MM-DD
    predicted_demand: float
    lower_bound: float
    upper_bound: float


class ModelEvaluationMetrics(BaseModel):
    mae: float = Field(..., description="Mean Absolute Error")
    rmse: float = Field(..., description="Root Mean Squared Error")
    mape: float = Field(..., description="Mean Absolute Percentage Error (%)")
    baseline_mae: Optional[float] = None
    baseline_rmse: Optional[float] = None
    comparison_verdict: Optional[str] = None


class ForecastTriggerRequest(BaseModel):
    product_id: Optional[str] = None  # None means forecast all eligible products
    horizon_days: int = Field(default=14, ge=1, le=90)
    algorithm: str = Field(default="random_forest", pattern=r"^(random_forest|linear|baseline)$")


class ForecastOut(BaseModel):
    id: str
    product_id: str
    sku: str
    product_name: Optional[str] = None
    model_name: str
    model_version: str
    forecast_horizon_days: int
    generated_at: datetime
    evaluation_metrics: Optional[ModelEvaluationMetrics] = None
    is_fallback: bool = False
    fallback_reason: Optional[str] = None
    historical_points_used: int = 0
    predictions: List[DailyPrediction]

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())


# -------------------------------------------------------------
# Reorder Recommendation Schemas
# -------------------------------------------------------------

class RecommendationUrgency(str, Enum):
    CRITICAL = "CRITICAL"   # Stock < Safety Stock or Runout within Lead Time
    WARNING = "WARNING"     # Stock <= Reorder Point
    OPTIMAL = "OPTIMAL"     # Stock healthy


class ReorderRecommendationOut(BaseModel):
    product_id: str
    sku: str
    product_name: str
    category: str
    current_stock: int
    daily_demand_rate: float
    lead_time_days: int
    safety_stock: int
    reorder_point: int
    recommended_reorder_quantity: int
    days_until_stockout: float
    urgency: RecommendationUrgency
    estimated_cost: float
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    reasoning: str
    calculation_breakdown: Dict[str, Any]


class RecommendationApprovalRequest(BaseModel):
    product_id: str
    recommended_quantity: int
    unit_cost: Optional[float] = None


# -------------------------------------------------------------
# Analytics Schemas
# -------------------------------------------------------------

class DateRevenueAgg(BaseModel):
    date: str
    revenue: float
    orders_count: int
    units_sold: int


class CategorySalesAgg(BaseModel):
    category: str
    total_revenue: float
    total_units_sold: int
    product_count: int
    revenue_percentage: float


class TopProductAgg(BaseModel):
    product_id: str
    sku: str
    name: str
    category: str
    total_units_sold: int
    total_revenue: float
    current_stock: int


class DashboardSummary(BaseModel):
    total_products: int
    low_stock_products_count: int
    out_of_stock_products_count: int
    total_stock_units: int
    total_inventory_valuation: float
    recent_30d_revenue: float
    recent_30d_orders: int
    pending_purchase_orders_count: int
    active_reorder_recommendations_count: int


# -------------------------------------------------------------
# Database Performance & Explain Schemas
# -------------------------------------------------------------

class QueryExplainResult(BaseModel):
    query_description: str
    collection: str
    index_used: Optional[str]
    stage: str
    execution_time_millis: float
    total_docs_examined: int
    total_keys_examined: int
    n_returned: int
    query_filter: Dict[str, Any]
    detailed_stats: Dict[str, Any]


class PerformanceReport(BaseModel):
    timestamp: datetime
    database_name: str
    indexes_by_collection: Dict[str, List[Dict[str, Any]]]
    indexed_query_benchmark: QueryExplainResult
    unindexed_query_benchmark: QueryExplainResult
    performance_summary: str


# -------------------------------------------------------------
# Settings Schemas
# -------------------------------------------------------------

class SystemSettings(BaseModel):
    default_lead_time_days: int = Field(default=7, ge=1, le=120)
    safety_stock_z_score: float = Field(default=1.65, ge=0.5, le=3.5, description="1.65=95%, 2.33=99%")
    annual_holding_cost_rate: float = Field(default=0.20, ge=0.01, le=1.0)
    fixed_order_cost: float = Field(default=50.0, ge=1.0)
    forecast_horizon_days: int = Field(default=14, ge=1, le=90)
    auto_reorder_enabled: bool = False
    updated_at: Optional[datetime] = None


class HealthResponse(BaseModel):
    status: str
    version: str
    database_connected: bool
    environment: str
    timestamp: datetime
