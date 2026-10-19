/**
 * API Client Layer
 * Communicates with FastAPI backend. Provides graceful fallback to labeled demo mode
 * if backend is cold-starting or unavailable.
 */

import {
  Product,
  ProductCreateInput,
  PaginatedProducts,
  Sale,
  SaleCreateInput,
  PaginatedSales,
  Supplier,
  SupplierCreateInput,
  PurchaseOrder,
  PurchaseOrderCreateInput,
  POStatus,
  Forecast,
  ReorderRecommendation,
  DashboardSummary,
  DateRevenueAgg,
  CategorySalesAgg,
  TopProductAgg,
  PerformanceReport,
  SystemSettings,
  HealthStatus
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiClient {
  private isOfflineMode = false;

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}`);
      }

      this.isOfflineMode = false;
      return await response.json();
    } catch (err: any) {
      console.warn(`API request to ${endpoint} failed: ${err.message}. Using fallback dataset.`);
      this.isOfflineMode = true;
      return this.getFallbackData<T>(endpoint, options);
    }
  }

  public getIsOffline(): boolean {
    return this.isOfflineMode;
  }

  // --- Health ---
  async checkHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/api/health');
  }

  // --- Products ---
  async getProducts(params: {
    page?: number;
    page_size?: number;
    search?: string;
    category?: string;
    low_stock_only?: boolean;
    sort_by?: string;
    sort_order?: string;
  } = {}): Promise<PaginatedProducts> {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page.toString());
    if (params.page_size) q.append('page_size', params.page_size.toString());
    if (params.search) q.append('search', params.search);
    if (params.category && params.category !== 'all') q.append('category', params.category);
    if (params.low_stock_only) q.append('low_stock_only', 'true');
    if (params.sort_by) q.append('sort_by', params.sort_by);
    if (params.sort_order) q.append('sort_order', params.sort_order);

    return this.request<PaginatedProducts>(`/api/products?${q.toString()}`);
  }

  async getProductById(id: string): Promise<Product> {
    return this.request<Product>(`/api/products/${id}`);
  }

  async createProduct(data: ProductCreateInput): Promise<Product> {
    return this.request<Product>('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: Partial<ProductCreateInput>): Promise<Product> {
    return this.request<Product>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: string): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>(`/api/products/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Sales ---
  async getSales(params: { page?: number; page_size?: number; product_id?: string; sku?: string } = {}): Promise<PaginatedSales> {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page.toString());
    if (params.page_size) q.append('page_size', params.page_size.toString());
    if (params.product_id) q.append('product_id', params.product_id);
    if (params.sku) q.append('sku', params.sku);

    return this.request<PaginatedSales>(`/api/sales?${q.toString()}`);
  }

  async recordSale(data: SaleCreateInput): Promise<Sale> {
    return this.request<Sale>('/api/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- Suppliers ---
  async getSuppliers(active_only = false): Promise<Supplier[]> {
    return this.request<Supplier[]>(`/api/suppliers?active_only=${active_only}`);
  }

  async createSupplier(data: SupplierCreateInput): Promise<Supplier> {
    return this.request<Supplier>('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSupplier(id: string, data: Partial<SupplierCreateInput>): Promise<Supplier> {
    return this.request<Supplier>(`/api/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSupplier(id: string): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>(`/api/suppliers/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Purchase Orders ---
  async getPurchaseOrders(status?: string, supplier_id?: string): Promise<PurchaseOrder[]> {
    const q = new URLSearchParams();
    if (status && status !== 'ALL') q.append('status', status);
    if (supplier_id) q.append('supplier_id', supplier_id);
    return this.request<PurchaseOrder[]>(`/api/purchase-orders?${q.toString()}`);
  }

  async createPurchaseOrder(data: PurchaseOrderCreateInput): Promise<PurchaseOrder> {
    return this.request<PurchaseOrder>('/api/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePOStatus(id: string, status: POStatus): Promise<PurchaseOrder> {
    return this.request<PurchaseOrder>(`/api/purchase-orders/${id}/status?new_status=${status}`, {
      method: 'PATCH',
    });
  }

  async receivePurchaseOrder(id: string, notes?: string): Promise<PurchaseOrder> {
    return this.request<PurchaseOrder>(`/api/purchase-orders/${id}/receive`, {
      method: 'POST',
      body: JSON.stringify({ received_notes: notes }),
    });
  }

  // --- Forecasts ---
  async getLatestForecast(productId: string): Promise<Forecast> {
    return this.request<Forecast>(`/api/forecasts/latest/${productId}`);
  }

  async getAllForecasts(): Promise<Forecast[]> {
    return this.request<Forecast[]>('/api/forecasts/all');
  }

  async triggerForecast(productId?: string, horizonDays = 14): Promise<Forecast[]> {
    return this.request<Forecast[]>('/api/forecasts/trigger', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, horizon_days: horizonDays }),
    });
  }

  // --- Recommendations ---
  async getRecommendations(urgency?: string): Promise<ReorderRecommendation[]> {
    const q = urgency ? `?urgency=${urgency}` : '';
    return this.request<ReorderRecommendation[]>(`/api/recommendations${q}`);
  }

  async convertRecommendationToPO(productId: string, quantity?: number): Promise<PurchaseOrder> {
    const q = new URLSearchParams({ product_id: productId });
    if (quantity) q.append('quantity', quantity.toString());
    return this.request<PurchaseOrder>(`/api/recommendations/convert-to-po?${q.toString()}`, {
      method: 'POST',
    });
  }

  // --- Analytics ---
  async getDashboardSummary(): Promise<DashboardSummary> {
    return this.request<DashboardSummary>('/api/analytics/summary');
  }

  async getRevenueTrends(days = 30): Promise<DateRevenueAgg[]> {
    return this.request<DateRevenueAgg[]>(`/api/analytics/revenue-trends?days=${days}`);
  }

  async getCategoryPerformance(): Promise<CategorySalesAgg[]> {
    return this.request<CategorySalesAgg[]>('/api/analytics/category-performance');
  }

  async getTopProducts(limit = 10, days = 90): Promise<TopProductAgg[]> {
    return this.request<TopProductAgg[]>(`/api/analytics/top-products?limit=${limit}&days=${days}`);
  }

  // --- Performance & Optimization ---
  async getPerformanceReport(): Promise<PerformanceReport> {
    return this.request<PerformanceReport>('/api/performance/explain');
  }

  async getIndexes(): Promise<Record<string, any[]>> {
    return this.request<Record<string, any[]>>('/api/performance/indexes');
  }

  // --- Settings ---
  async getSettings(): Promise<SystemSettings> {
    return this.request<SystemSettings>('/api/settings');
  }

  async updateSettings(settings: SystemSettings): Promise<SystemSettings> {
    return this.request<SystemSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // --- System ---
  async seedDatabase(force = false): Promise<any> {
    return this.request<any>(`/api/system/seed?force=${force}`, { method: 'POST' });
  }

  // -------------------------------------------------------------
  // Labeled Demo Fallback Data Generator
  // -------------------------------------------------------------
  private getFallbackData<T>(endpoint: string, options: RequestInit): T {
    if (endpoint.includes('/api/health')) {
      return {
        status: 'degraded',
        version: '1.0.0 (Demo Mode)',
        database_connected: false,
        environment: 'demo-fallback',
        timestamp: new Date().toISOString()
      } as unknown as T;
    }

    if (endpoint.includes('/api/analytics/summary')) {
      return {
        total_products: 20,
        low_stock_products_count: 5,
        out_of_stock_products_count: 0,
        total_stock_units: 729,
        total_inventory_valuation: 3482.50,
        recent_30d_revenue: 12450.80,
        recent_30d_orders: 864,
        pending_purchase_orders_count: 2,
        active_reorder_recommendations_count: 5
      } as unknown as T;
    }

    if (endpoint.includes('/api/analytics/revenue-trends')) {
      const trends: DateRevenueAgg[] = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        trends.push({
          date: d.toISOString().split('T')[0],
          revenue: Math.round(300 + Math.sin(i / 3) * 120 + (i % 7 > 4 ? 140 : 0)),
          orders_count: Math.round(25 + Math.random() * 15),
          units_sold: Math.round(60 + Math.random() * 30)
        });
      }
      return trends as unknown as T;
    }

    if (endpoint.includes('/api/analytics/category-performance')) {
      return [
        { category: 'Beverages', total_revenue: 4890.50, total_units_sold: 1420, product_count: 5, revenue_percentage: 39.3 },
        { category: 'Dairy & Fresh', total_revenue: 3420.10, total_units_sold: 980, product_count: 4, revenue_percentage: 27.5 },
        { category: 'Pantry Staples', total_revenue: 2680.40, total_units_sold: 640, product_count: 6, revenue_percentage: 21.5 },
        { category: 'Snacks', total_revenue: 1459.80, total_units_sold: 430, product_count: 5, revenue_percentage: 11.7 }
      ] as unknown as T;
    }

    if (endpoint.includes('/api/analytics/top-products')) {
      return [
        { product_id: 'bev-001', sku: 'BEV-001', name: 'Cold Pressed Orange Juice (1L)', category: 'Beverages', total_units_sold: 420, total_revenue: 2305.80, current_stock: 42 },
        { product_id: 'dai-001', sku: 'DAI-001', name: 'Whole Farm Milk (2L)', category: 'Dairy & Fresh', total_units_sold: 390, total_revenue: 1517.10, current_stock: 65 },
        { product_id: 'snk-001', sku: 'SNK-001', name: 'Sea Salt Kettle Chips (150g)', category: 'Snacks', total_units_sold: 360, total_revenue: 1256.40, current_stock: 72 },
        { product_id: 'bev-003', sku: 'BEV-003', name: 'Sparkling Mineral Water (750ml)', category: 'Beverages', total_units_sold: 330, total_revenue: 986.70, current_stock: 110 }
      ] as unknown as T;
    }

    if (endpoint.includes('/api/products')) {
      const demoProducts: Product[] = [
        { id: '1', sku: 'BEV-001', name: 'Cold Pressed Orange Juice (1L)', category: 'Beverages', unit_price: 5.49, cost_price: 3.10, current_stock: 42, reorder_threshold: 30, safety_stock: 18, supplier_code: 'SUP-001', supplier_name: 'Cascade Beverage Distributors', is_low_stock: false },
        { id: '2', sku: 'BEV-002', name: 'Organic Oat Milk Barista (1L)', category: 'Beverages', unit_price: 4.29, cost_price: 2.40, current_stock: 25, reorder_threshold: 35, safety_stock: 20, supplier_code: 'SUP-001', supplier_name: 'Cascade Beverage Distributors', is_low_stock: true },
        { id: '3', sku: 'DAI-001', name: 'Whole Farm Milk (2L)', category: 'Dairy & Fresh', unit_price: 3.89, cost_price: 2.10, current_stock: 65, reorder_threshold: 40, safety_stock: 22, supplier_code: 'SUP-002', supplier_name: 'Sunrise Dairy & Farm Co.', is_low_stock: false },
        { id: '4', sku: 'DAI-004', name: 'Salted Farmhouse Butter (250g)', category: 'Dairy & Fresh', unit_price: 4.79, cost_price: 2.80, current_stock: 19, reorder_threshold: 30, safety_stock: 16, supplier_code: 'SUP-002', supplier_name: 'Sunrise Dairy & Farm Co.', is_low_stock: true },
        { id: '5', sku: 'PAN-003', name: 'Jasmine Fragrant Rice (5kg)', category: 'Pantry Staples', unit_price: 14.99, cost_price: 8.50, current_stock: 14, reorder_threshold: 20, safety_stock: 10, supplier_code: 'SUP-003', supplier_name: 'Golden Grain Milling Co.', is_low_stock: true },
        { id: '6', sku: 'SNK-001', name: 'Sea Salt Kettle Chips (150g)', category: 'Snacks', unit_price: 3.49, cost_price: 1.50, current_stock: 72, reorder_threshold: 40, safety_stock: 20, supplier_code: 'SUP-004', supplier_name: 'Apex Snack & Confectionery', is_low_stock: false }
      ];
      return {
        items: demoProducts,
        pagination: { page: 1, page_size: 20, total_count: demoProducts.length, total_pages: 1 }
      } as unknown as T;
    }

    if (endpoint.includes('/api/recommendations')) {
      const recs: ReorderRecommendation[] = [
        {
          product_id: '2',
          sku: 'BEV-002',
          product_name: 'Organic Oat Milk Barista (1L)',
          category: 'Beverages',
          current_stock: 25,
          daily_demand_rate: 18.2,
          lead_time_days: 5,
          safety_stock: 20,
          reorder_point: 111,
          recommended_reorder_quantity: 90,
          days_until_stockout: 1.4,
          urgency: 'CRITICAL',
          estimated_cost: 216.0,
          supplier_name: 'Cascade Beverage Distributors',
          reasoning: 'Stock is critically low (25 units). Estimated stockout in 1.4 days, well within supplier lead time (5 days).',
          calculation_breakdown: { daily_demand_mean: 18.2, lead_time_days: 5, calculated_safety_stock: 20, calculated_reorder_point: 111 }
        },
        {
          product_id: '4',
          sku: 'DAI-004',
          product_name: 'Salted Farmhouse Butter (250g)',
          category: 'Dairy & Fresh',
          current_stock: 19,
          daily_demand_rate: 16.0,
          lead_time_days: 3,
          safety_stock: 16,
          reorder_point: 64,
          recommended_reorder_quantity: 50,
          days_until_stockout: 1.2,
          urgency: 'CRITICAL',
          estimated_cost: 140.0,
          supplier_name: 'Sunrise Dairy & Farm Co.',
          reasoning: 'Current stock of 19 units is below safety buffer (16 units). Rapid stockout danger.',
          calculation_breakdown: { daily_demand_mean: 16.0, lead_time_days: 3, calculated_safety_stock: 16, calculated_reorder_point: 64 }
        },
        {
          product_id: '5',
          sku: 'PAN-003',
          product_name: 'Jasmine Fragrant Rice (5kg)',
          category: 'Pantry Staples',
          current_stock: 14,
          daily_demand_rate: 7.0,
          lead_time_days: 10,
          safety_stock: 10,
          reorder_point: 80,
          recommended_reorder_quantity: 66,
          days_until_stockout: 2.0,
          urgency: 'WARNING',
          estimated_cost: 561.0,
          supplier_name: 'Golden Grain Milling Co.',
          reasoning: 'Stock level (14 units) has breached reorder point (80 units). Replenishment required.',
          calculation_breakdown: { daily_demand_mean: 7.0, lead_time_days: 10, calculated_safety_stock: 10, calculated_reorder_point: 80 }
        }
      ];
      return recs as unknown as T;
    }

    if (endpoint.includes('/api/suppliers')) {
      return [
        { id: 's1', supplier_code: 'SUP-001', name: 'Cascade Beverage Distributors', contact_email: 'orders@cascadebeverage.com', phone: '+1 (555) 234-5678', lead_time_days: 5, lead_time_variance_days: 1.2, active: true, product_count: 5 },
        { id: 's2', supplier_code: 'SUP-002', name: 'Sunrise Dairy & Farm Co.', contact_email: 'logistics@sunrisedairy.com', phone: '+1 (555) 345-6789', lead_time_days: 3, lead_time_variance_days: 0.8, active: true, product_count: 4 },
        { id: 's3', supplier_code: 'SUP-003', name: 'Golden Grain Milling Co.', contact_email: 'wholesale@goldengrain.com', phone: '+1 (555) 456-7890', lead_time_days: 10, lead_time_variance_days: 2.1, active: true, product_count: 6 },
        { id: 's4', supplier_code: 'SUP-004', name: 'Apex Snack & Confectionery', contact_email: 'supply@apexsnacks.com', phone: '+1 (555) 567-8901', lead_time_days: 7, lead_time_variance_days: 1.5, active: true, product_count: 5 }
      ] as unknown as T;
    }

    if (endpoint.includes('/api/purchase-orders')) {
      return [
        {
          id: 'po1',
          po_number: 'PO-2026-0001',
          supplier_id: 's1',
          supplier_name: 'Cascade Beverage Distributors',
          status: 'RECEIVED',
          total_cost: 251.0,
          created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
          received_at: new Date(Date.now() - 19 * 86400000).toISOString(),
          items: [
            { product_id: '1', sku: 'BEV-001', product_name: 'Cold Pressed Orange Juice (1L)', quantity: 50, unit_cost: 3.10, received_quantity: 50 },
            { product_id: '2', sku: 'BEV-002', product_name: 'Organic Oat Milk Barista (1L)', quantity: 40, unit_cost: 2.40, received_quantity: 40 }
          ]
        },
        {
          id: 'po2',
          po_number: 'PO-2026-0002',
          supplier_id: 's3',
          supplier_name: 'Golden Grain Milling Co.',
          status: 'ORDERED',
          total_cost: 255.0,
          created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
          expected_delivery_date: new Date(Date.now() + 7 * 86400000).toISOString(),
          items: [
            { product_id: '5', sku: 'PAN-003', product_name: 'Jasmine Fragrant Rice (5kg)', quantity: 30, unit_cost: 8.50, received_quantity: 0 }
          ]
        }
      ] as unknown as T;
    }

    if (endpoint.includes('/api/performance/explain')) {
      return {
        timestamp: new Date().toISOString(),
        database_name: 'inventory_forecasting',
        indexes_by_collection: {
          products: [{ name: 'idx_products_sku_unique', unique: true }, { name: 'idx_products_category_stock' }],
          sales: [{ name: 'idx_sales_product_date_compound', unique: false }, { name: 'idx_sales_idempotency_unique', unique: true }]
        },
        indexed_query_benchmark: {
          query_description: 'Compound Index Query: (product_id: 1, sale_date: -1)',
          collection: 'sales',
          index_used: 'idx_sales_product_date_compound',
          stage: 'IXSCAN',
          execution_time_millis: 0.8,
          total_docs_examined: 48,
          total_keys_examined: 48,
          n_returned: 48,
          query_filter: { product_id: 'BEV-001', sale_date: '>= 60 days' },
          detailed_stats: { stage: 'IXSCAN', execution_time_millis: 0.8 }
        },
        unindexed_query_benchmark: {
          query_description: 'Unindexed Table Scan (Forced Natural Collection Scan)',
          collection: 'sales',
          index_used: null,
          stage: 'COLLSCAN',
          execution_time_millis: 6.4,
          total_docs_examined: 3240,
          total_keys_examined: 0,
          n_returned: 48,
          query_filter: { product_id: 'BEV-001', sale_date: '>= 60 days' },
          detailed_stats: { stage: 'COLLSCAN', execution_time_millis: 6.4 }
        },
        performance_summary: 'Index Optimization Result: Compound index idx_sales_product_date_compound bypassed 3,192 unnecessary documents using B-tree key scanning.'
      } as unknown as T;
    }

    if (endpoint.includes('/api/settings')) {
      return {
        default_lead_time_days: 7,
        safety_stock_z_score: 1.65,
        annual_holding_cost_rate: 0.20,
        fixed_order_cost: 50.0,
        forecast_horizon_days: 14,
        auto_reorder_enabled: false
      } as unknown as T;
    }

    return {} as unknown as T;
  }
}

export const api = new ApiClient();
