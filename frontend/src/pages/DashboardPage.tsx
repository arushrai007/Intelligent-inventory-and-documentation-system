import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  AlertTriangle,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  ClipboardList,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api } from '../api/client';
import { DashboardSummary, DateRevenueAgg, ReorderRecommendation, Sale } from '../api/types';
import { useSystem } from '../context/SystemContext';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const DashboardPage: React.FC = () => {
  const { refreshKey } = useSystem();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [revenueTrends, setRevenueTrends] = useState<DateRevenueAgg[]>([]);
  const [criticalRecs, setCriticalRecs] = useState<ReorderRecommendation[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [sumData, revData, recData, salesData] = await Promise.all([
          api.getDashboardSummary(),
          api.getRevenueTrends(30),
          api.getRecommendations('CRITICAL'),
          api.getSales({ page: 1, page_size: 5 })
        ]);
        setSummary(sumData);
        setRevenueTrends(revData);
        setCriticalRecs(recData);
        setRecentSales(salesData.items);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [refreshKey]);

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Products
            </span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {summary ? summary.total_products : '...'}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              ({summary ? summary.total_stock_units.toLocaleString() : 0} units)
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Valuation: ${summary ? summary.total_inventory_valuation.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700 uppercase tracking-wider">
              Stock Warnings
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 font-mono">
              {summary ? summary.low_stock_products_count : '...'}
            </span>
            <span className="text-xs text-slate-500">at or below threshold</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Out of stock: <span className="font-semibold text-rose-600">{summary?.out_of_stock_products_count ?? 0}</span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              30-Day Revenue
            </span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              ${summary ? summary.recent_30d_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {summary ? summary.recent_30d_orders.toLocaleString() : 0} transactions recorded
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Pending Orders
            </span>
            <ClipboardList className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {summary ? summary.pending_purchase_orders_count : '...'}
            </span>
            <span className="text-xs text-slate-500">awaiting receipt</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Action items: <span className="font-semibold text-slate-700">{criticalRecs.length} critical</span>
          </div>
        </Card>
      </div>

      {/* Main Grid: Revenue Trends & Stockout Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: 30-Day Revenue Chart */}
        <div className="lg:col-span-2">
          <Card
            title="30-Day Revenue Trend"
            subtitle="Calculated dynamically using MongoDB date-grouping aggregation pipeline"
          >
            <div className="h-72 w-full pt-2">
              {revenueTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      stroke="#94a3b8"
                      fontSize={11}
                      tickFormatter={(val) => val.slice(5)}
                    />
                    <YAxis
                      tickLine={false}
                      stroke="#94a3b8"
                      fontSize={11}
                      tickFormatter={(val) => `$${val}`}
                    />
                    <Tooltip
                      formatter={(val: number) => [`$${val.toFixed(2)}`, 'Revenue']}
                      labelFormatter={(label) => `Date: ${label}`}
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '4px', color: '#f8fafc', fontSize: '12px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#revenueGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Loading revenue aggregation...
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Critical Restock Urgent Actions */}
        <div>
          <Card
            title="Urgent Reorder Alerts"
            subtitle="Identified via lead time demand & safety buffer"
            action={
              <Link to="/recommendations" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            }
          >
            <div className="space-y-3">
              {criticalRecs.length > 0 ? (
                criticalRecs.slice(0, 4).map((rec) => (
                  <div
                    key={rec.product_id}
                    className="p-3 border border-rose-100 bg-rose-50/50 rounded flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-xs text-slate-900">{rec.product_name}</div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">{rec.sku}</div>
                      </div>
                      <Badge variant="rose" size="sm">CRITICAL</Badge>
                    </div>

                    <div className="grid grid-cols-2 text-xs pt-1 border-t border-rose-100/60 text-slate-600">
                      <div>Stock: <span className="font-bold text-rose-700">{rec.current_stock}</span> units</div>
                      <div className="text-right">Runout: <span className="font-bold text-rose-700">{rec.days_until_stockout}d</span></div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-500">Suggested: {rec.recommended_reorder_quantity} units</span>
                      <Link
                        to={`/recommendations`}
                        className="text-xs text-slate-800 font-semibold hover:underline"
                      >
                        Order Now
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-500">
                  <ShieldAlert className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                  No critical stockouts detected. Buffer levels are within acceptable thresholds.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Table: Recent Transactions */}
      <Card
        title="Recent Sales Transactions"
        subtitle="Live ledger with atomic stock decrements"
        action={
          <Link to="/sales" className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1">
            Sales Ledger <ArrowRight className="w-3 h-3" />
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-2 font-medium">Timestamp</th>
                <th className="pb-2 font-medium">SKU</th>
                <th className="pb-2 font-medium">Product</th>
                <th className="pb-2 font-medium text-right">Quantity</th>
                <th className="pb-2 font-medium text-right">Unit Price</th>
                <th className="pb-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {recentSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 text-slate-600 font-sans">
                    {new Date(sale.sale_date).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="py-2.5 font-semibold text-slate-800">{sale.sku}</td>
                  <td className="py-2.5 text-slate-700 font-sans">{sale.product_name || sale.sku}</td>
                  <td className="py-2.5 text-right font-semibold text-slate-900">{sale.quantity}</td>
                  <td className="py-2.5 text-right text-slate-600">${sale.unit_price.toFixed(2)}</td>
                  <td className="py-2.5 text-right font-bold text-slate-900">${sale.total_amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
