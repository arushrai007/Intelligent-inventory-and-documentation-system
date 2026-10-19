import React, { useState, useEffect } from 'react';
import { AlertOctagon, CheckCircle2, ChevronDown, ChevronRight, ShoppingCart, HelpCircle } from 'lucide-react';
import { api } from '../api/client';
import { ReorderRecommendation, RecommendationUrgency } from '../api/types';
import { useSystem } from '../context/SystemContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';

export const RecommendationsPage: React.FC = () => {
  const { refreshKey, showToast, triggerRefresh } = useSystem();
  const [recommendations, setRecommendations] = useState<ReorderRecommendation[]>([]);
  const [urgencyFilter, setUrgencyFilter] = useState<string>('ALL');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Convert to PO state
  const [selectedRec, setSelectedRec] = useState<ReorderRecommendation | null>(null);
  const [orderQty, setOrderQty] = useState<number>(0);
  const [isSubmittingPO, setIsSubmittingPO] = useState(false);

  const loadRecommendations = async () => {
    setIsLoading(true);
    try {
      const data = await api.getRecommendations(urgencyFilter);
      setRecommendations(data);
    } catch (err: any) {
      showToast(err.message || 'Error loading recommendations', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
  }, [urgencyFilter, refreshKey]);

  const toggleRow = (prodId: string) => {
    setExpandedRows((prev) => ({ ...prev, [prodId]: !prev[prodId] }));
  };

  const handleOpenPOModal = (rec: ReorderRecommendation) => {
    setSelectedRec(rec);
    setOrderQty(rec.recommended_reorder_quantity > 0 ? rec.recommended_reorder_quantity : 25);
  };

  const handleConfirmConvert = async () => {
    if (!selectedRec) return;
    setIsSubmittingPO(true);
    try {
      const po = await api.convertRecommendationToPO(selectedRec.product_id, orderQty);
      showToast(
        `Purchase Order ${po.po_number} created for ${orderQty} units of ${selectedRec.sku}. View under Purchase Orders.`,
        'success'
      );
      setSelectedRec(null);
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to create Purchase Order', 'error');
    } finally {
      setIsSubmittingPO(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview explanation card */}
      <Card className="bg-slate-900 text-white border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Inventory Optimization & Reorder Recommendations
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Answers the core inventory questions: <em>What to reorder? How much to reorder? When will current stock run out?</em>{' '}
              Calculated dynamically using continuous daily demand variance, supplier lead times, and configurable safety buffers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Filter Urgency:</span>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="text-xs bg-slate-800 border border-slate-700 text-white rounded px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Items</option>
              <option value="CRITICAL">Critical Action Only</option>
              <option value="WARNING">Warning (At Reorder Point)</option>
              <option value="OPTIMAL">Optimal / Healthy</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Recommendations Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                <th className="py-2.5 px-3 font-medium w-8"></th>
                <th className="py-2.5 px-3 font-medium">SKU</th>
                <th className="py-2.5 px-3 font-medium">Product Name</th>
                <th className="py-2.5 px-3 font-medium text-right">Current Stock</th>
                <th className="py-2.5 px-3 font-medium text-right">Daily Demand</th>
                <th className="py-2.5 px-3 font-medium text-right">Lead Time</th>
                <th className="py-2.5 px-3 font-medium text-right">Reorder Pt</th>
                <th className="py-2.5 px-3 font-medium text-right">Stockout In</th>
                <th className="py-2.5 px-3 font-medium text-right">Recommended Qty</th>
                <th className="py-2.5 px-3 font-medium">Urgency</th>
                <th className="py-2.5 px-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {recommendations.map((rec) => {
                const isExpanded = !!expandedRows[rec.product_id];
                return (
                  <React.Fragment key={rec.product_id}>
                    <tr className={`hover:bg-slate-50/60 ${isExpanded ? 'bg-slate-50/80' : ''}`}>
                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => toggleRow(rec.product_id)}
                          className="text-slate-400 hover:text-slate-700"
                          title="Expand calculation formula details"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">{rec.sku}</td>
                      <td className="py-3 px-3 text-slate-900 font-sans font-medium">{rec.product_name}</td>
                      <td className="py-3 px-3 text-right font-bold">
                        <span className={rec.urgency === 'CRITICAL' ? 'text-rose-700' : rec.urgency === 'WARNING' ? 'text-amber-700' : 'text-slate-900'}>
                          {rec.current_stock}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700">{rec.daily_demand_rate.toFixed(1)}/d</td>
                      <td className="py-3 px-3 text-right text-slate-600">{rec.lead_time_days}d</td>
                      <td className="py-3 px-3 text-right text-slate-700 font-semibold">{rec.reorder_point}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={rec.days_until_stockout <= rec.lead_time_days ? 'text-rose-700 font-bold' : 'text-slate-700'}>
                          {rec.days_until_stockout}d
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-800">
                        {rec.recommended_reorder_quantity > 0 ? `${rec.recommended_reorder_quantity} units` : '-'}
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            rec.urgency === 'CRITICAL'
                              ? 'rose'
                              : rec.urgency === 'WARNING'
                              ? 'amber'
                              : 'emerald'
                          }
                          size="sm"
                        >
                          {rec.urgency}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {rec.recommended_reorder_quantity > 0 ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenPOModal(rec)}
                          >
                            <ShoppingCart className="w-3 h-3 mr-1" />
                            Create PO
                          </Button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-sans">Stock Optimal</span>
                        )}
                      </td>
                    </tr>

                    {/* Expandable Calculation Breakdown Drawer */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90 text-xs font-sans">
                        <td colSpan={11} className="py-3 px-6 border-b border-slate-200">
                          <div className="p-3 bg-white border border-slate-200 rounded space-y-2">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <span className="font-semibold text-slate-900">
                                Mathematical Calculation Breakdown ({rec.sku})
                              </span>
                              <span className="text-slate-500 text-xs font-mono">
                                Supplier: {rec.supplier_name || 'Direct'}
                              </span>
                            </div>

                            <p className="text-xs text-slate-700 leading-relaxed font-mono bg-slate-50 p-2 rounded">
                              {rec.reasoning}
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
                              <div className="border border-slate-100 p-2 rounded">
                                <span className="font-semibold text-slate-800 block">1. Safety Stock (SS):</span>
                                <span className="font-mono text-[11px] text-slate-600">
                                  Formula: Z * sqrt(L * σ_d² + d² * σ_L²)
                                </span>
                                <div className="mt-1 font-bold text-slate-900 font-mono">
                                  = {rec.safety_stock} units buffer
                                </div>
                              </div>

                              <div className="border border-slate-100 p-2 rounded">
                                <span className="font-semibold text-slate-800 block">2. Reorder Point (ROP):</span>
                                <span className="font-mono text-[11px] text-slate-600">
                                  Formula: Lead_Time_Demand + Safety_Stock
                                </span>
                                <div className="mt-1 font-bold text-slate-900 font-mono">
                                  = {rec.reorder_point} units
                                </div>
                              </div>

                              <div className="border border-slate-100 p-2 rounded">
                                <span className="font-semibold text-slate-800 block">3. Batch Sizing (EOQ):</span>
                                <span className="font-mono text-[11px] text-slate-600">
                                  Formula: sqrt((2 * D_annual * S) / H)
                                </span>
                                <div className="mt-1 font-bold text-slate-900 font-mono">
                                  = {rec.calculation_breakdown.calculated_eoq || 25} units
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Approve into Purchase Order Modal */}
      <Modal
        isOpen={!!selectedRec}
        onClose={() => setSelectedRec(null)}
        title={`Generate Purchase Order: ${selectedRec?.sku}`}
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 leading-relaxed">
            This action creates an official purchase order from the intelligent reorder advice.
            Upon physical delivery, receiving this order will automatically restock inventory.
          </p>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5 font-mono">
            <div>Product: <strong className="font-sans text-slate-900">{selectedRec?.product_name}</strong></div>
            <div>Supplier: <span className="text-slate-700">{selectedRec?.supplier_name || 'Standard'}</span></div>
            <div>Current Stock: <span className="text-rose-700 font-bold">{selectedRec?.current_stock}</span> units</div>
            <div>Calculated Reorder Point: <span className="text-slate-900">{selectedRec?.reorder_point}</span> units</div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Confirmed Order Quantity (Units):
            </label>
            <input
              type="number"
              min="1"
              value={orderQty}
              onChange={(e) => setOrderQty(parseInt(e.target.value) || 1)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-sm"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedRec(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirmConvert} isLoading={isSubmittingPO}>
              Approve & Create Purchase Order
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
