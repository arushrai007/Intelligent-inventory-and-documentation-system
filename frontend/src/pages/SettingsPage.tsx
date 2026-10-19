import React, { useState, useEffect } from 'react';
import { Sliders, Save, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';
import { api } from '../api/client';
import { SystemSettings } from '../api/types';
import { useSystem } from '../context/SystemContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export const SettingsPage: React.FC = () => {
  const { refreshKey, showToast, triggerRefresh } = useSystem();
  const [settings, setSettings] = useState<SystemSettings>({
    default_lead_time_days: 7,
    safety_stock_z_score: 1.65,
    annual_holding_cost_rate: 0.20,
    fixed_order_cost: 50.0,
    forecast_horizon_days: 14,
    auto_reorder_enabled: false
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const s = await api.getSettings();
        setSettings(s);
      } catch (err: any) {
        showToast(err.message || 'Error loading settings', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, [refreshKey]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      showToast('Inventory policy assumptions updated successfully.', 'success');
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to update settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <Card
        title="Supply Chain & Inventory Policy Parameters"
        subtitle="These mathematical variables directly determine the Safety Stock (SS) and Economic Order Quantity (EOQ) calculations across all products."
      >
        <form onSubmit={handleSave} className="space-y-6 text-xs">
          {/* Section 1: Service Level and Safety Stock */}
          <div className="border-b border-slate-100 pb-5">
            <h4 className="text-sm font-semibold text-slate-900 mb-1">
              Safety Stock & Service Level (Z-Factor)
            </h4>
            <p className="text-slate-500 mb-3">
              Controls stockout protection level. A higher Z-score increases the buffer size to absorb demand surges.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Service Level Z-Score:
                </label>
                <select
                  value={settings.safety_stock_z_score}
                  onChange={(e) =>
                    setSettings({ ...settings, safety_stock_z_score: parseFloat(e.target.value) })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono"
                >
                  <option value={1.28}>1.28 (90% Cycle Service Level)</option>
                  <option value={1.65}>1.65 (95% Cycle Service Level - Recommended)</option>
                  <option value={1.96}>1.96 (97.5% Cycle Service Level)</option>
                  <option value={2.33}>2.33 (99% Cycle Service Level)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Default Supplier Lead Time (Days):
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={settings.default_lead_time_days}
                  onChange={(e) =>
                    setSettings({ ...settings, default_lead_time_days: parseInt(e.target.value) || 1 })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Financial Costs & EOQ */}
          <div className="border-b border-slate-100 pb-5">
            <h4 className="text-sm font-semibold text-slate-900 mb-1">
              Holding Costs & Batch Sizing (EOQ)
            </h4>
            <p className="text-slate-500 mb-3">
              Parameters used by the Wilson Economic Order Quantity formula: EOQ = sqrt((2 * D * S) / H).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Annual Holding Cost Rate (fraction of unit cost):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.05"
                  max="0.80"
                  value={settings.annual_holding_cost_rate}
                  onChange={(e) =>
                    setSettings({ ...settings, annual_holding_cost_rate: parseFloat(e.target.value) || 0.2 })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Example: 0.20 represents a 20% annual cost for warehouse storage, insurance, and capital.
                </span>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Fixed Ordering Cost ($ per Purchase Order):
                </label>
                <input
                  type="number"
                  step="1.0"
                  min="5"
                  value={settings.fixed_order_cost}
                  onChange={(e) =>
                    setSettings({ ...settings, fixed_order_cost: parseFloat(e.target.value) || 50.0 })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Administrative cost incurred for placing and processing an order.
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Forecasting Horizon */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-1">
              Forecasting Defaults
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Default Forecast Horizon (Days):
                </label>
                <input
                  type="number"
                  min="7"
                  max="60"
                  value={settings.forecast_horizon_days}
                  onChange={(e) =>
                    setSettings({ ...settings, forecast_horizon_days: parseInt(e.target.value) || 14 })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <Button variant="primary" size="md" type="submit" isLoading={isSaving}>
              <Save className="w-4 h-4 mr-1.5" />
              Save Policy Assumptions
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
