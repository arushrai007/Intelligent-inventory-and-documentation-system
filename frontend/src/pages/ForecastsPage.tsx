import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Cpu,
  BarChart2,
  RefreshCw,
  AlertTriangle,
  Info,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { api } from '../api/client';
import { Forecast, Product } from '../api/types';
import { useSystem } from '../context/SystemContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';

export const ForecastsPage: React.FC = () => {
  const { refreshKey, showToast } = useSystem();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [horizonDays, setHorizonDays] = useState<number>(14);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTraining, setIsTraining] = useState<boolean>(false);

  // Load products list
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await api.getProducts({ page: 1, page_size: 50 });
        setProducts(res.items);
        if (res.items.length > 0 && !selectedProductId) {
          setSelectedProductId(res.items[0].id);
        }
      } catch (err: any) {
        showToast(err.message || 'Error loading product list', 'error');
      }
    };
    loadProducts();
  }, [refreshKey]);

  // Load forecast for selected product
  const loadForecast = async (productId: string) => {
    if (!productId) return;
    setIsLoading(true);
    try {
      const f = await api.getLatestForecast(productId);
      setForecast(f);
    } catch (err: any) {
      showToast(err.message || 'Could not retrieve forecast', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProductId) {
      loadForecast(selectedProductId);
    }
  }, [selectedProductId, refreshKey]);

  // Handle re-training & forecast generation
  const handleTriggerForecast = async () => {
    if (!selectedProductId) return;
    setIsTraining(true);
    try {
      const results = await api.triggerForecast(selectedProductId, horizonDays);
      if (results && results.length > 0) {
        setForecast(results[0]);
        showToast(
          `Demand model trained: ${results[0].model_name} generated ${results[0].forecast_horizon_days}-day forecast.`,
          'success'
        );
      }
    } catch (err: any) {
      showToast(err.message || 'Error training model', 'error');
    } finally {
      setIsTraining(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Prepare chart data format
  const chartData = (forecast?.predictions || []).map((p) => ({
    date: p.date.slice(5), // MM-DD
    fullDate: p.date,
    predicted: p.predicted_demand,
    lower: p.lower_bound,
    upper: p.upper_bound,
    interval: [p.lower_bound, p.upper_bound]
  }));

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 border border-slate-200 rounded-md">
        <div className="flex flex-1 items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
            Target Product:
          </label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 max-w-md w-full focus:outline-none"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} : {p.name} ({p.current_stock} in stock)
              </option>
            ))}
          </select>

          <label className="text-xs font-semibold text-slate-700 whitespace-nowrap ml-2">
            Horizon:
          </label>
          <select
            value={horizonDays}
            onChange={(e) => setHorizonDays(Number(e.target.value))}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 focus:outline-none"
          >
            <option value={7}>7 Days</option>
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
          </select>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleTriggerForecast}
          isLoading={isTraining}
        >
          <Cpu className="w-3.5 h-3.5 mr-1 text-emerald-400" />
          Train & Run Model
        </Button>
      </div>

      {/* Sparse Data Warning if Fallback was triggered */}
      {forecast?.is_fallback && (
        <Alert variant="warning" title="Sparse Historical Data Notice">
          {forecast.fallback_reason ||
            'Insufficient historical observations to train Random Forest. The system employed a 7-day Simple Moving Average baseline to generate safe estimates.'}
        </Alert>
      )}

      {/* Model Performance Scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Selected Model
            </span>
            <Cpu className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-base font-bold text-slate-900">
            {forecast?.model_name || 'RandomForestRegressor'}
          </div>
          <div className="mt-1 text-xs font-mono text-slate-500">
            v{forecast?.model_version || 'rf-v1.2.0'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Mean Absolute Error (MAE)
            </span>
            <BarChart2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {forecast?.evaluation_metrics ? forecast.evaluation_metrics.mae.toFixed(2) : '0.00'}
            </span>
            <span className="text-xs text-slate-500">units/day</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Baseline MAE: {forecast?.evaluation_metrics?.baseline_mae?.toFixed(2) || '0.00'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              RMSE (Root Mean Sq Error)
            </span>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {forecast?.evaluation_metrics ? forecast.evaluation_metrics.rmse.toFixed(2) : '0.00'}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            MAPE: {forecast?.evaluation_metrics ? `${forecast.evaluation_metrics.mape.toFixed(1)}%` : '0%'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Training Points
            </span>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {forecast?.historical_points_used || 180}
            </span>
            <span className="text-xs text-slate-500">daily observations</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Time-aware 80/20 train/test split
          </div>
        </Card>
      </div>

      {/* Model Comparison Explanation Banner */}
      {forecast?.evaluation_metrics?.comparison_verdict && (
        <div className="p-3 bg-slate-900 text-slate-200 border border-slate-800 rounded text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Validation Verdict:</strong> {forecast.evaluation_metrics.comparison_verdict}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
            Generated: {new Date(forecast.generated_at).toLocaleString()}
          </span>
        </div>
      )}

      {/* Main Demand Forecast Visualization */}
      <Card
        title={`Forecast Demand Projection: ${selectedProduct?.name || ''}`}
        subtitle={`Expected daily demand over the next ${horizonDays} days with 90% confidence uncertainty interval (±1.65σ)`}
      >
        <div className="h-80 w-full pt-2">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 15, right: 15, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickLine={false} stroke="#94a3b8" fontSize={11} />
                <YAxis
                  tickLine={false}
                  stroke="#94a3b8"
                  fontSize={11}
                  label={{ value: 'Units / Day', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }}
                />
                <Tooltip
                  formatter={(val: any, name: string) => [
                    typeof val === 'number' ? val.toFixed(1) : val,
                    name === 'predicted' ? 'Predicted Demand' : name === 'upper' ? 'Upper Bound' : 'Lower Bound'
                  ]}
                  labelFormatter={(lbl) => `Forecast Date: ${lbl}`}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '4px', color: '#f8fafc', fontSize: '12px' }}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(val) =>
                    val === 'predicted'
                      ? 'Point Forecast (Units/Day)'
                      : val === 'upper'
                      ? 'Upper Confidence Bound'
                      : 'Lower Confidence Bound'
                  }
                />
                {/* Upper and Lower Confidence Bounds */}
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="#cbd5e1"
                  strokeDasharray="3 3"
                  fill="#f1f5f9"
                  fillOpacity={0.6}
                  name="upper"
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="#cbd5e1"
                  strokeDasharray="3 3"
                  fill="#ffffff"
                  fillOpacity={1.0}
                  name="lower"
                />
                {/* Point Prediction Line */}
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#0f172a"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#0f172a' }}
                  name="predicted"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No forecast points available. Click "Train & Run Model".
            </div>
          )}
        </div>
      </Card>

      {/* Predictions Table */}
      <Card
        title="Day-by-Day Forecast Schedule"
        subtitle="Individual predictions stored in MongoDB forecasts collection"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                <th className="py-2.5 px-3 font-medium">Date</th>
                <th className="py-2.5 px-3 font-medium text-right">Predicted Demand</th>
                <th className="py-2.5 px-3 font-medium text-right">Lower Bound (-1.65σ)</th>
                <th className="py-2.5 px-3 font-medium text-right">Upper Bound (+1.65σ)</th>
                <th className="py-2.5 px-3 font-medium text-right">Expected Stock Depletion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(forecast?.predictions || []).map((p, idx) => (
                <tr key={p.date} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-slate-800 font-sans">{p.date}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">{p.predicted_demand.toFixed(1)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">{p.lower_bound.toFixed(1)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">{p.upper_bound.toFixed(1)}</td>
                  <td className="py-2.5 px-3 text-right text-rose-700 font-semibold">
                    -{Math.ceil(p.predicted_demand)} units
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
