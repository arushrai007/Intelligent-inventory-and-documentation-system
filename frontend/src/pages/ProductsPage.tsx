import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit, Trash2, ArrowUpDown } from 'lucide-react';
import { api } from '../api/client';
import { Product, ProductCreateInput, Supplier } from '../api/types';
import { useSystem } from '../context/SystemContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';

export const ProductsPage: React.FC = () => {
  const { refreshKey, showToast, triggerRefresh } = useSystem();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total_count: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form inputs
  const [formData, setFormData] = useState<ProductCreateInput>({
    sku: '',
    name: '',
    category: 'Beverages',
    unit_price: 4.99,
    cost_price: 2.50,
    current_stock: 50,
    reorder_threshold: 25,
    safety_stock: 15,
    supplier_id: '',
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, supRes] = await Promise.all([
        api.getProducts({
          page: pagination.page,
          page_size: 15,
          search,
          category,
          low_stock_only: lowStockOnly,
          sort_by: sortBy,
          sort_order: sortOrder
        }),
        api.getSuppliers(true)
      ]);
      setProducts(prodRes.items);
      setPagination({
        page: prodRes.pagination.page,
        total_pages: prodRes.pagination.total_pages,
        total_count: prodRes.pagination.total_count
      });
      setSuppliers(supRes);
    } catch (err: any) {
      showToast(err.message || 'Error loading products', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [pagination.page, search, category, lowStockOnly, sortBy, sortOrder, refreshKey]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createProduct(formData);
      showToast(`Product ${formData.sku} registered successfully.`, 'success');
      setIsAddModalOpen(false);
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to create product', 'error');
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      await api.updateProduct(selectedProduct.id, {
        name: formData.name,
        category: formData.category,
        unit_price: Number(formData.unit_price),
        cost_price: Number(formData.cost_price),
        current_stock: Number(formData.current_stock),
        reorder_threshold: Number(formData.reorder_threshold),
        safety_stock: Number(formData.safety_stock),
        supplier_id: formData.supplier_id || null
      });
      showToast(`Product ${selectedProduct.sku} updated.`, 'success');
      setIsEditModalOpen(false);
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to update product', 'error');
    }
  };

  const handleDeleteProduct = async (prod: Product) => {
    if (!window.confirm(`Delete product ${prod.name} (${prod.sku})? This cannot be undone.`)) return;
    try {
      await api.deleteProduct(prod.id);
      showToast(`Product ${prod.sku} removed.`, 'success');
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'Cannot delete product with sales history.', 'error');
    }
  };

  const openEditModal = (prod: Product) => {
    setSelectedProduct(prod);
    setFormData({
      sku: prod.sku,
      name: prod.name,
      category: prod.category,
      unit_price: prod.unit_price,
      cost_price: prod.cost_price,
      current_stock: prod.current_stock,
      reorder_threshold: prod.reorder_threshold,
      safety_stock: prod.safety_stock,
      supplier_id: prod.supplier_id || ''
    });
    setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 border border-slate-200 rounded-md">
        <div className="flex flex-1 items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by SKU or product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-600"
            />
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="Beverages">Beverages</option>
            <option value="Dairy & Fresh">Dairy & Fresh</option>
            <option value="Pantry Staples">Pantry Staples</option>
            <option value="Snacks">Snacks</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs text-slate-600 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            Low stock alerts only
          </label>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setFormData({
              sku: '',
              name: '',
              category: 'Beverages',
              unit_price: 5.0,
              cost_price: 2.5,
              current_stock: 40,
              reorder_threshold: 20,
              safety_stock: 10,
              supplier_id: suppliers[0]?.id || ''
            });
            setIsAddModalOpen(true);
          }}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Product
        </Button>
      </div>

      {/* Product Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                <th className="py-2.5 px-3 font-medium">SKU</th>
                <th className="py-2.5 px-3 font-medium">Product Name</th>
                <th className="py-2.5 px-3 font-medium">Category</th>
                <th className="py-2.5 px-3 font-medium text-right">Price</th>
                <th className="py-2.5 px-3 font-medium text-right">Cost</th>
                <th className="py-2.5 px-3 font-medium text-right">On-Hand Stock</th>
                <th className="py-2.5 px-3 font-medium text-right">Reorder Pt</th>
                <th className="py-2.5 px-3 font-medium">Supplier</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((prod) => (
                <tr key={prod.id} className="hover:bg-slate-50/60">
                  <td className="py-3 px-3 font-mono font-semibold text-slate-800">{prod.sku}</td>
                  <td className="py-3 px-3 font-medium text-slate-900">{prod.name}</td>
                  <td className="py-3 px-3 text-slate-600">{prod.category}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-800">${prod.unit_price.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-500">${prod.cost_price.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right font-mono font-bold">
                    <span className={prod.current_stock <= prod.reorder_threshold ? 'text-amber-700' : 'text-slate-900'}>
                      {prod.current_stock}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-600">{prod.reorder_threshold}</td>
                  <td className="py-3 px-3 text-slate-600 truncate max-w-[140px]">{prod.supplier_name || 'Unassigned'}</td>
                  <td className="py-3 px-3">
                    {prod.current_stock === 0 ? (
                      <Badge variant="rose" size="sm">Out of Stock</Badge>
                    ) : prod.is_low_stock ? (
                      <Badge variant="amber" size="sm">Low Stock</Badge>
                    ) : (
                      <Badge variant="emerald" size="sm">Adequate</Badge>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                    <button
                      onClick={() => openEditModal(prod)}
                      className="p-1 text-slate-500 hover:text-slate-800 transition-colors"
                      title="Edit Product"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(prod)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Delete Product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No products found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500">
          <div>
            Showing {products.length} of {pagination.total_count} products
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

      {/* Add Product Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Register New Product">
        <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">SKU (e.g. BEV-005)</label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 uppercase font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
              >
                <option value="Beverages">Beverages</option>
                <option value="Dairy & Fresh">Dairy & Fresh</option>
                <option value="Pantry Staples">Pantry Staples</option>
                <option value="Snacks">Snacks</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Product Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Selling Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Cost Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Initial Stock</label>
              <input
                type="number"
                min="0"
                required
                value={formData.current_stock}
                onChange={(e) => setFormData({ ...formData, current_stock: parseInt(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Reorder Pt</label>
              <input
                type="number"
                min="0"
                required
                value={formData.reorder_threshold}
                onChange={(e) => setFormData({ ...formData, reorder_threshold: parseInt(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Safety Buffer</label>
              <input
                type="number"
                min="0"
                required
                value={formData.safety_stock}
                onChange={(e) => setFormData({ ...formData, safety_stock: parseInt(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Supplier Reference</label>
            <select
              value={formData.supplier_id || ''}
              onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
            >
              <option value="">Select a supplier...</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name} ({sup.lead_time_days}d lead time)
                </option>
              ))}
            </select>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Product
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Product Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`Edit Product: ${selectedProduct?.sku}`}>
        <form onSubmit={handleUpdateProduct} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Product Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
              >
                <option value="Beverages">Beverages</option>
                <option value="Dairy & Fresh">Dairy & Fresh</option>
                <option value="Pantry Staples">Pantry Staples</option>
                <option value="Snacks">Snacks</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Supplier</label>
              <select
                value={formData.supplier_id || ''}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
              >
                <option value="">Unassigned</option>
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>{sup.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Unit Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Cost Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Current Stock</label>
              <input
                type="number"
                min="0"
                required
                value={formData.current_stock}
                onChange={(e) => setFormData({ ...formData, current_stock: parseInt(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Reorder Pt</label>
              <input
                type="number"
                min="0"
                required
                value={formData.reorder_threshold}
                onChange={(e) => setFormData({ ...formData, reorder_threshold: parseInt(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Safety Buffer</label>
              <input
                type="number"
                min="0"
                required
                value={formData.safety_stock}
                onChange={(e) => setFormData({ ...formData, safety_stock: parseInt(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Update Product
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
