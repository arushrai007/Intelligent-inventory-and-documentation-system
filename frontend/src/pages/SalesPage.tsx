import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { Sale, Product } from '../api/types';
import { useSystem } from '../context/SystemContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Alert } from '../components/ui/Alert';

export const SalesPage: React.FC = () => {
  const { refreshKey, showToast, triggerRefresh } = useSystem();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total_count: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Record Sale Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [salesRes, prodRes] = await Promise.all([
        api.getSales({ page: pagination.page, page_size: 20 }),
        api.getProducts({ page: 1, page_size: 100 })
      ]);
      setSales(salesRes.items);
      setPagination({
        page: salesRes.pagination.page,
        total_pages: salesRes.pagination.total_pages,
        total_count: salesRes.pagination.total_count
      });
      setProducts(prodRes.items);
      if (prodRes.items.length > 0 && !selectedProductId) {
        setSelectedProductId(prodRes.items[0].id);
        setUnitPrice(prodRes.items[0].unit_price);
      }
    } catch (err: any) {
      showToast(err.message || 'Error loading sales ledger', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [pagination.page, refreshKey]);

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setUnitPrice(prod.unit_price);
    }
    setFormError(null);
  };

  const handleRecordSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedProduct) {
      setFormError('Please select a product.');
      return;
    }

    if (quantity > selectedProduct.current_stock) {
      setFormError(
        `Insufficient inventory: Only ${selectedProduct.current_stock} units available on hand.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Generate client-side idempotency key
      const idempotencyKey = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const res = await api.recordSale({
        product_id: selectedProduct.id,
        quantity: Number(quantity),
        unit_price: unitPrice !== '' ? Number(unitPrice) : selectedProduct.unit_price,
        idempotency_key: idempotencyKey
      });

      showToast(
        `Sale recorded: ${res.quantity}x ${res.sku} ($${res.total_amount.toFixed(2)}). Stock reduced to ${selectedProduct.current_stock - res.quantity}.`,
        'success'
      );
      setIsModalOpen(false);
      setQuantity(1);
      triggerRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Transaction rejected by inventory service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-white p-4 border border-slate-200 rounded-md">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Sales Transactions Ledger</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict transactional consistency: transactions deduct stock atomically and reject overselling.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setIsModalOpen(true);
            setFormError(null);
          }}
        >
          <ShoppingCart className="w-3.5 h-3.5 mr-1" />
          Record New Sale
        </Button>
      </div>

      {/* Sales Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                <th className="py-2.5 px-3 font-medium">Transaction Timestamp</th>
                <th className="py-2.5 px-3 font-medium">SKU</th>
                <th className="py-2.5 px-3 font-medium">Product Name</th>
                <th className="py-2.5 px-3 font-medium text-right">Units Sold</th>
                <th className="py-2.5 px-3 font-medium text-right">Unit Price</th>
                <th className="py-2.5 px-3 font-medium text-right">Gross Total</th>
                <th className="py-2.5 px-3 font-medium">Idempotency Token</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50/60">
                  <td className="py-3 px-3 text-slate-600 font-sans">
                    {new Date(sale.sale_date).toLocaleString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900">{sale.sku}</td>
                  <td className="py-3 px-3 text-slate-800 font-sans">{sale.product_name || sale.sku}</td>
                  <td className="py-3 px-3 text-right font-semibold text-slate-900">{sale.quantity}</td>
                  <td className="py-3 px-3 text-right text-slate-600">${sale.unit_price.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-700">${sale.total_amount.toFixed(2)}</td>
                  <td className="py-3 px-3 text-slate-400 text-[11px] truncate max-w-[120px]">
                    {sale.idempotency_key || 'standard-pos'}
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                    No sales transactions recorded yet. Click "Record New Sale" to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500">
          <div>
            Showing {sales.length} of {pagination.total_count} transactions
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            >
              Previous
            </Button>
            <span className="font-mono text-slate-700">
              Page {pagination.page} / {pagination.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.total_pages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Record Sale Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Customer Sale Transaction">
        <form onSubmit={handleRecordSale} className="space-y-4 text-xs">
          {formError && (
            <Alert variant="danger" title="Validation Failed">
              {formError}
            </Alert>
          )}

          <div>
            <label className="block font-medium text-slate-700 mb-1">Select Product</label>
            <select
              value={selectedProductId}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-2 bg-white text-slate-800"
              required
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} : {p.name} (Available: {p.current_stock} in stock)
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
              <div>
                <span className="text-slate-500">Current Stock:</span>{' '}
                <span className="font-bold text-slate-900 font-mono">{selectedProduct.current_stock}</span> units
              </div>
              <div>
                <span className="text-slate-500">Catalog Price:</span>{' '}
                <span className="font-bold text-slate-900 font-mono">${selectedProduct.unit_price.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Quantity Sold</label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Sale Price Override ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || '')}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded flex justify-between items-center text-emerald-900">
            <span className="font-medium">Total Transaction Amount:</span>
            <span className="font-mono font-bold text-base">
              ${(quantity * (unitPrice !== '' ? Number(unitPrice) : selectedProduct?.unit_price || 0)).toFixed(2)}
            </span>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              Confirm & Deduct Stock
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
