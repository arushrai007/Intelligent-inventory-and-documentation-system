import React, { useState, useEffect } from 'react';
import { Truck, Plus, Mail, Phone, Clock, Edit, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { Supplier, SupplierCreateInput } from '../api/types';
import { useSystem } from '../context/SystemContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';

export const SuppliersPage: React.FC = () => {
  const { refreshKey, showToast, triggerRefresh } = useSystem();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState<SupplierCreateInput>({
    supplier_code: '',
    name: '',
    contact_email: '',
    phone: '',
    lead_time_days: 7,
    lead_time_variance_days: 1.0,
    active: true
  });

  const loadSuppliers = async () => {
    setIsLoading(true);
    try {
      const data = await api.getSuppliers();
      setSuppliers(data);
    } catch (err: any) {
      showToast(err.message || 'Error loading suppliers', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, [refreshKey]);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSupplier(formData);
      showToast(`Supplier ${formData.name} added successfully.`, 'success');
      setIsAddModalOpen(false);
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to register supplier', 'error');
    }
  };

  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    try {
      await api.updateSupplier(selectedSupplier.id, formData);
      showToast(`Supplier ${selectedSupplier.name} updated.`, 'success');
      setIsEditModalOpen(false);
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to update supplier', 'error');
    }
  };

  const handleDeleteSupplier = async (sup: Supplier) => {
    if (!window.confirm(`Delete supplier ${sup.name}?`)) return;
    try {
      await api.deleteSupplier(sup.id);
      showToast(`Supplier ${sup.name} removed.`, 'success');
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'Cannot delete supplier with linked products.', 'error');
    }
  };

  const openEdit = (sup: Supplier) => {
    setSelectedSupplier(sup);
    setFormData({
      supplier_code: sup.supplier_code,
      name: sup.name,
      contact_email: sup.contact_email,
      phone: sup.phone,
      lead_time_days: sup.lead_time_days,
      lead_time_variance_days: sup.lead_time_variance_days,
      active: sup.active
    });
    setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-white p-4 border border-slate-200 rounded-md">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Supplier Directory & Fulfillment Parameters</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Lead times and variability directly drive Safety Stock (SS) and Reorder Point (ROP) equations.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setFormData({
              supplier_code: `SUP-00${suppliers.length + 1}`,
              name: '',
              contact_email: '',
              phone: '',
              lead_time_days: 7,
              lead_time_variance_days: 1.0,
              active: true
            });
            setIsAddModalOpen(true);
          }}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Supplier
        </Button>
      </div>

      {/* Supplier Cards / Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map((sup) => (
          <Card key={sup.id} className="p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-semibold text-slate-500 uppercase">{sup.supplier_code}</span>
                  <h4 className="font-semibold text-sm text-slate-900 mt-0.5">{sup.name}</h4>
                </div>
                <Badge variant={sup.active ? 'emerald' : 'slate'} size="sm">
                  {sup.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Lead Time: <strong className="text-slate-800 font-mono">{sup.lead_time_days} days</strong> (std dev ±{sup.lead_time_variance_days}d)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{sup.contact_email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{sup.phone}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                <strong className="text-slate-700 font-mono">{sup.product_count}</strong> linked products
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(sup)}
                  className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                  title="Edit"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteSupplier(sup)}
                  className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Supplier Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Register New Supplier">
        <form onSubmit={handleCreateSupplier} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Code (e.g. SUP-006)</label>
              <input
                type="text"
                required
                value={formData.supplier_code}
                onChange={(e) => setFormData({ ...formData, supplier_code: e.target.value.toUpperCase() })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 uppercase font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Lead Time (Days)</label>
              <input
                type="number"
                min="1"
                max="120"
                required
                value={formData.lead_time_days}
                onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) || 1 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Lead Time Variance (Days)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.lead_time_variance_days}
                onChange={(e) => setFormData({ ...formData, lead_time_variance_days: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Supplier
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Supplier Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`Edit Supplier: ${selectedSupplier?.name}`}>
        <form onSubmit={handleUpdateSupplier} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Company Name</label>
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
              <label className="block font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Lead Time (Days)</label>
              <input
                type="number"
                min="1"
                max="120"
                required
                value={formData.lead_time_days}
                onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) || 1 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Lead Time Variance (Days)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.lead_time_variance_days}
                onChange={(e) => setFormData({ ...formData, lead_time_variance_days: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Update Supplier
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
