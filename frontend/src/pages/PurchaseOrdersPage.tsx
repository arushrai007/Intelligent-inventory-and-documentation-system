import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, PackageCheck, Check, Clock, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import { PurchaseOrder, POStatus, Supplier, Product } from '../api/types';
import { useSystem } from '../context/SystemContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';

export const PurchaseOrdersPage: React.FC = () => {
  const { refreshKey, showToast, triggerRefresh } = useSystem();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Manual PO Creation Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [orderQty, setOrderQty] = useState(20);
  const [orderNotes, setOrderNotes] = useState('');

  // Receive Order Confirmation Modal
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [isReceiving, setIsReceiving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [poRes, supRes, prodRes] = await Promise.all([
        api.getPurchaseOrders(statusFilter),
        api.getSuppliers(true),
        api.getProducts({ page: 1, page_size: 100 })
      ]);
      setOrders(poRes);
      setSuppliers(supRes);
      setProducts(prodRes.items);
      if (supRes.length > 0 && !selectedSupplierId) setSelectedSupplierId(supRes[0].id);
      if (prodRes.items.length > 0 && !selectedProductId) setSelectedProductId(prodRes.items[0].id);
    } catch (err: any) {
      showToast(err.message || 'Error loading purchase orders', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, refreshKey]);

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    try {
      await api.createPurchaseOrder({
        supplier_id: selectedSupplierId,
        items: [
          {
            product_id: prod.id,
            sku: prod.sku,
            product_name: prod.name,
            quantity: Number(orderQty),
            unit_cost: prod.cost_price
          }
        ],
        notes: orderNotes || 'Manual restocking purchase order'
      });
      showToast('Purchase Order registered.', 'success');
      setIsAddModalOpen(false);
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to create PO', 'error');
    }
  };

  const handleUpdateStatus = async (poId: string, status: POStatus) => {
    try {
      await api.updatePOStatus(poId, status);
      showToast(`Purchase order status updated to ${status}.`, 'success');
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const handleConfirmReceive = async () => {
    if (!receivingPO) return;
    setIsReceiving(true);
    try {
      const updated = await api.receivePurchaseOrder(receivingPO.id, receiveNotes);
      showToast(
        `Purchase Order ${updated.po_number} marked RECEIVED. On-hand stock incremented for all line items.`,
        'success'
      );
      setReceivingPO(null);
      setReceiveNotes('');
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'Error receiving order', 'error');
    } finally {
      setIsReceiving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 border border-slate-200 rounded-md">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Purchase Order Management & Stock Inflow</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Idempotent stock updates: receiving orders updates current stock atomically with duplicate prevention.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Approval</option>
            <option value="ORDERED">Ordered / In Transit</option>
            <option value="RECEIVED">Received & Restocked</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Purchase Order
          </Button>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {orders.map((po) => {
          const isReceived = po.status === 'RECEIVED';
          return (
            <Card key={po.id} className="p-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm text-slate-900">{po.po_number}</span>
                  <Badge
                    variant={
                      po.status === 'RECEIVED'
                        ? 'emerald'
                        : po.status === 'ORDERED'
                        ? 'indigo'
                        : po.status === 'PENDING'
                        ? 'amber'
                        : 'slate'
                    }
                    size="sm"
                  >
                    {po.status}
                  </Badge>
                  <span className="text-xs text-slate-500 font-sans">
                    Supplier: <strong className="text-slate-800">{po.supplier_name || 'Standard'}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-mono">
                    Created: {new Date(po.created_at).toLocaleDateString()}
                  </span>
                  {po.received_at && (
                    <span className="text-xs text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded">
                      Received: {new Date(po.received_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Line items table */}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="pb-1.5 font-medium">SKU</th>
                      <th className="pb-1.5 font-medium">Product Description</th>
                      <th className="pb-1.5 font-medium text-right">Quantity Ordered</th>
                      <th className="pb-1.5 font-medium text-right">Unit Cost</th>
                      <th className="pb-1.5 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {po.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 text-slate-800 font-bold">{item.sku}</td>
                        <td className="py-2 text-slate-700 font-sans">{item.product_name}</td>
                        <td className="py-2 text-right font-bold text-slate-900">{item.quantity} units</td>
                        <td className="py-2 text-right text-slate-600">${item.unit_cost.toFixed(2)}</td>
                        <td className="py-2 text-right text-slate-900 font-bold">
                          ${(item.quantity * item.unit_cost).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Order Footer & Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="text-slate-500 font-sans">
                  Total Order Value: <strong className="text-slate-900 font-mono text-sm">${po.total_cost.toFixed(2)}</strong>
                  {po.notes && <span className="ml-3 italic text-slate-400">({po.notes})</span>}
                </div>

                <div className="flex items-center gap-2">
                  {po.status === 'PENDING' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateStatus(po.id, 'ORDERED')}
                    >
                      <Clock className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      Mark Ordered
                    </Button>
                  )}

                  {(po.status === 'ORDERED' || po.status === 'PENDING') && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setReceivingPO(po)}
                    >
                      <PackageCheck className="w-3.5 h-3.5 mr-1" />
                      Receive & Restock Stock
                    </Button>
                  )}

                  {po.status === 'RECEIVED' && (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                      <Check className="w-4 h-4 text-emerald-600" />
                      Inventory Restocked
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {orders.length === 0 && (
          <Card className="py-12 text-center text-xs text-slate-400">
            No purchase orders matching the selected filter.
          </Card>
        )}
      </div>

      {/* Manual PO Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Issue New Purchase Order">
        <form onSubmit={handleCreatePO} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Select Supplier</label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
              required
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.lead_time_days} days lead time)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Target Product</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
              required
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} : {p.name} (Current: {p.current_stock})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Quantity to Order</label>
            <input
              type="number"
              min="1"
              required
              value={orderQty}
              onChange={(e) => setOrderQty(parseInt(e.target.value) || 1)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Order Notes (Optional)</label>
            <input
              type="text"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="e.g. Standard weekly restock delivery"
              className="w-full border border-slate-300 rounded px-2.5 py-1.5"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Submit Purchase Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* Receive Confirmation Modal */}
      <Modal
        isOpen={!!receivingPO}
        onClose={() => setReceivingPO(null)}
        title={`Receive Goods: ${receivingPO?.po_number}`}
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 leading-relaxed">
            Confirming receipt will mark purchase order <strong>{receivingPO?.po_number}</strong> as received
            and atomically increment on-hand inventory for:
          </p>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1 font-mono">
            {receivingPO?.items.map((it, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{it.sku} ({it.product_name}):</span>
                <strong className="text-emerald-700">+{it.quantity} units</strong>
              </div>
            ))}
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Receipt Notes / Inspection:</label>
            <input
              type="text"
              value={receiveNotes}
              onChange={(e) => setReceiveNotes(e.target.value)}
              placeholder="e.g. Delivered by carrier in good condition, seal intact"
              className="w-full border border-slate-300 rounded px-2.5 py-1.5"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setReceivingPO(null)}>
              Cancel
            </Button>
            <Button variant="secondary" size="sm" onClick={handleConfirmReceive} isLoading={isReceiving}>
              Confirm Delivery & Restock Inventory
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
