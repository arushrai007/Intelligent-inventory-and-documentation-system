import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  Code2,
  Calendar,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { api } from '../api/client';
import { DateRevenueAgg, CategorySalesAgg, TopProductAgg } from '../api/types';
import { useSystem } from '../context/SystemContext';
import { Card } from '../components/ui/Card';

export const AnalyticsPage: React.FC = () => {
  const { refreshKey } = useSystem();
  const [revenueTrends, setRevenueTrends] = useState<DateRevenueAgg[]>([]);
  const [categorySales, setCategorySales] = useState<CategorySalesAgg[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductAgg[]>([]);
  const [timeframeDays, setTimeframeDays] = useState<number>(30);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      setIsLoading(true);
      try {
        const [revData, catData, topData] = await Promise.all([
          api.getRevenueTrends(timeframeDays),
          api.getCategoryPerformance(),
          api.getTopProducts(10, timeframeDays)
        ]);
        setRevenueTrends(revData);
        setCategorySales(catData);
        setTopProducts(topData);
      } catch (err) {
        console.error('Error loading analytics:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadAnalytics();
  }, [timeframeDays, refreshKey]);

  return (
    <div className="space-y-6">
      {/* Header filter bar */}
      <div className="flex items-center justify-between bg-white p-4 border border-slate-200 rounded-md">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            MongoDB Aggregation Pipeline Analytics
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real multi-stage pipelines demonstrating $match, $group, $sort, $project, $lookup, and $unwind.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-600">Aggregation Horizon:</span>
          <select
            value={timeframeDays}
            onChange={(e) => setTimeframeDays(Number(e.target.value))}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800"
          >
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={60}>Last 60 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* Grid: Revenue Trend & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline 1: Date Revenue Aggregation */}
        <Card
          title="Daily Revenue & Volume Aggregation"
          subtitle="Pipeline stages: $match (date range) -> $project (format date) -> $group (sum) -> $sort"
        >
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickLine={false} stroke="#94a3b8" fontSize={11} tickFormatter={(v) => v.slice(5)} />
                <YAxis tickLine={false} stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(val: number) => [`$${val.toFixed(2)}`, 'Revenue']}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '4px', color: '#f8fafc', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#0284c7" strokeWidth={2} fillOpacity={1} fill="url(#analyticsRevGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 p-2.5 bg-slate-50 border border-slate-100 rounded text-[11px] font-mono text-slate-600">
            db.sales.aggregate([ &#123;$match: ...&#125;, &#123;$group: &#123;_id: "$date_str", revenue: &#123;$sum: "$total_amount"&#125;&#125;&#125;, &#123;$sort: &#123;_id: 1&#125;&#125; ])
          </div>
        </Card>

        {/* Pipeline 2: Category Breakdown */}
        <Card
          title="Revenue Share by Product Category"
          subtitle="Pipeline stages: $lookup (products) -> $unwind -> $group (category sum) -> $sort"
        >
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categorySales} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="category" tickLine={false} stroke="#94a3b8" fontSize={11} />
                <YAxis tickLine={false} stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(val: number) => [`$${val.toFixed(2)}`, 'Revenue']}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '4px', color: '#f8fafc', fontSize: '12px' }}
                />
                <Bar dataKey="total_revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 p-2.5 bg-slate-50 border border-slate-100 rounded text-[11px] font-mono text-slate-600">
            db.sales.aggregate([ &#123;$lookup: &#123;from: "products", ...&#125;&#125;, &#123;$unwind: "$product_info"&#125;, &#123;$group: ...&#125; ])
          </div>
        </Card>
      </div>

      {/* Pipeline 3: Top Selling Products */}
      <Card
        title="Top Selling Products Ranking"
        subtitle="Pipeline stages: $match -> $group (product_id sum) -> $sort (units DESC) -> $limit (10) -> $lookup (products) -> $unwind"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                <th className="py-2.5 px-3 font-medium">Rank</th>
                <th className="py-2.5 px-3 font-medium">SKU</th>
                <th className="py-2.5 px-3 font-medium font-sans">Product Name</th>
                <th className="py-2.5 px-3 font-medium font-sans">Category</th>
                <th className="py-2.5 px-3 font-medium text-right">Units Sold</th>
                <th className="py-2.5 px-3 font-medium text-right">Gross Revenue</th>
                <th className="py-2.5 px-3 font-medium text-right">Remaining Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topProducts.map((prod, idx) => (
                <tr key={prod.product_id} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-3 font-bold text-slate-400">#{idx + 1}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-800">{prod.sku}</td>
                  <td className="py-2.5 px-3 font-sans font-medium text-slate-900">{prod.name}</td>
                  <td className="py-2.5 px-3 font-sans text-slate-600">{prod.category}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">{prod.total_units_sold}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-700">${prod.total_revenue.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-600">{prod.current_stock} units</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
