/**
 * TypeScript Data Models matching Backend Pydantic Schemas
 */

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit_price: number;
  cost_price: number;
  current_stock: number;
  reorder_threshold: number;
  safety_stock: number;
  supplier_id?: string | null;
  supplier_code?: string | null;
  supplier_name?: string | null;
  is_low_stock: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProductCreateInput {
  sku: string;
  name: string;
  category: string;
  unit_price: number;
  cost_price: number;
  current_stock: number;
  reorder_threshold: number;
  safety_stock: number;
  supplier_id?: string | null;
  supplier_code?: string | null;
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
}

export interface PaginatedProducts {
  items: Product[];
  pagination: PaginationMeta;
}

export interface Sale {
  id: string;
  product_id: string;
  sku: string;
  product_name?: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  sale_date: string;
  idempotency_key?: string | null;
}

export interface SaleCreateInput {
  product_id: string;
  quantity: number;
  unit_price?: number;
  idempotency_key?: string;
}

export interface PaginatedSales {
  items: Sale[];
  pagination: PaginationMeta;
}

export interface Supplier {
  id: string;
  supplier_code: string;
  name: string;
  contact_email: string;
  phone: string;
  lead_time_days: number;
  lead_time_variance_days: number;
  active: boolean;
  product_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface SupplierCreateInput {
  supplier_code: string;
  name: string;
  contact_email: string;
  phone: string;
  lead_time_days: number;
  lead_time_variance_days?: number;
  active?: boolean;
}

export type POStatus = 'PENDING' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderItem {
  product_id: string;
  sku: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  received_quantity: number;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name?: string | null;
  status: POStatus;
  items: PurchaseOrderItem[];
  total_cost: number;
  created_at: string;
  expected_delivery_date?: string | null;
  received_at?: string | null;
  notes?: string | null;
}

export interface PurchaseOrderCreateInput {
  supplier_id: string;
  items: {
    product_id: string;
    sku: string;
    product_name: string;
    quantity: number;
    unit_cost: number;
  }[];
  expected_delivery_date?: string;
  notes?: string;
}

export interface DailyPrediction {
  date: string;
  predicted_demand: number;
  lower_bound: number;
  upper_bound: number;
}

export interface ModelEvaluationMetrics {
  mae: number;
  rmse: number;
  mape: number;
  baseline_mae?: number;
  baseline_rmse?: number;
  comparison_verdict?: string;
}

export interface Forecast {
  id: string;
  product_id: string;
  sku: string;
  product_name?: string | null;
  model_name: string;
  model_version: string;
  forecast_horizon_days: number;
  generated_at: string;
  evaluation_metrics?: ModelEvaluationMetrics | null;
  is_fallback: boolean;
  fallback_reason?: string | null;
  historical_points_used: number;
  predictions: DailyPrediction[];
}

export type RecommendationUrgency = 'CRITICAL' | 'WARNING' | 'OPTIMAL';

export interface ReorderRecommendation {
  product_id: string;
  sku: string;
  product_name: string;
  category: string;
  current_stock: number;
  daily_demand_rate: number;
  lead_time_days: number;
  safety_stock: number;
  reorder_point: number;
  recommended_reorder_quantity: number;
  days_until_stockout: number;
  urgency: RecommendationUrgency;
  estimated_cost: number;
  supplier_id?: string | null;
  supplier_name?: string | null;
  reasoning: string;
  calculation_breakdown: Record<string, any>;
}

export interface DashboardSummary {
  total_products: number;
  low_stock_products_count: number;
  out_of_stock_products_count: number;
  total_stock_units: number;
  total_inventory_valuation: number;
  recent_30d_revenue: number;
  recent_30d_orders: number;
  pending_purchase_orders_count: number;
  active_reorder_recommendations_count: number;
}

export interface DateRevenueAgg {
  date: string;
  revenue: number;
  orders_count: number;
  units_sold: number;
}

export interface CategorySalesAgg {
  category: string;
  total_revenue: number;
  total_units_sold: number;
  product_count: number;
  revenue_percentage: number;
}

export interface TopProductAgg {
  product_id: string;
  sku: string;
  name: string;
  category: string;
  total_units_sold: number;
  total_revenue: number;
  current_stock: number;
}

export interface QueryExplainResult {
  query_description: string;
  collection: string;
  index_used?: string | null;
  stage: string;
  execution_time_millis: number;
  total_docs_examined: number;
  total_keys_examined: number;
  n_returned: number;
  query_filter: Record<string, any>;
  detailed_stats: Record<string, any>;
}

export interface PerformanceReport {
  timestamp: string;
  database_name: string;
  indexes_by_collection: Record<string, any[]>;
  indexed_query_benchmark: QueryExplainResult;
  unindexed_query_benchmark: QueryExplainResult;
  performance_summary: string;
}

export interface SystemSettings {
  default_lead_time_days: number;
  safety_stock_z_score: number;
  annual_holding_cost_rate: number;
  fixed_order_cost: number;
  forecast_horizon_days: number;
  auto_reorder_enabled: boolean;
  updated_at?: string;
}

export interface HealthStatus {
  status: string;
  version: string;
  database_connected: boolean;
  environment: string;
  timestamp: string;
}
