'use client';

import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { supplierApi, type Supplier } from '@/lib/api';
import {
  Plus,
  Search,
  X,
  FileText,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

const inputCls =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500';

type FormData = {
  name: string;
  email: string;
  street_name: string;
  city: string;
  county: string;
  zip_code: string;
  phone: string;
  notes: string;
};

const EMPTY_FORM: FormData = {
  name: '',
  email: '',
  street_name: '',
  city: '',
  county: '',
  zip_code: '',
  phone: '',
  notes: '',
};

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-3 bg-slate-200 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 bg-green-700 text-white text-sm rounded-xl px-4 py-3 shadow-lg animate-fade-in">
      <CheckCircle2 size={16} />
      {message}
      <button onClick={onClose} className="ml-1 text-green-200 hover:text-white">
        <X size={14} />
      </button>
    </div>
  );
}

export default function SuppliersPage() {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const canWrite = true;

  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Supplier | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const itemList = await supplierApi.list();
      setItems(itemList);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = items
    .filter((item) => {
      const q = search.toLowerCase();
      return !q || item.name.toLowerCase().includes(q) || (item.city ?? '').toLowerCase().includes(q) || (item.email ?? '').toLowerCase().includes(q);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  function openAdd() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(item: Supplier) {
    setEditItem(item);
    setForm({
      name: item.name,
      email: item.email ?? '',
      street_name: item.street_name ?? '',
      city: item.city ?? '',
      county: item.county ?? '',
      zip_code: item.zip_code ?? '',
      phone: item.phone ?? '',
      notes: item.notes ?? '',
    });
    setFormError('');
    setShowModal(true);
  }

  async function handleSave() {
    setFormError('');
    if (!form.name.trim()) { setFormError('Supplier name is required.'); return; }

    setFormLoading(true);
    try {
      const payload: Partial<Supplier> = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        street_name: form.street_name.trim() || null,
        city: form.city.trim() || null,
        county: form.county.trim() || null,
        zip_code: form.zip_code.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (editItem) {
        await supplierApi.update(editItem.id, payload);
        setToast('Supplier updated successfully.');
      } else {
        await supplierApi.create(payload);
        setToast('Supplier added successfully.');
      }

      setShowModal(false);
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Save failed. Please try again.');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await supplierApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      setToast('Supplier deleted.');
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Delete failed.');
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <TopBar
        title="Supplier Database"
        subtitle={
          loading
            ? 'Loading suppliers…'
            : `${items.length} ${items.length === 1 ? 'supplier' : 'suppliers'}`
        }
      />

      <main className="flex-1 p-4 md:p-6 space-y-4">
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 w-full sm:w-64">
                <Search size={14} className="text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search suppliers…"
                  className="bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none w-full"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {canWrite && (
              <div className="flex items-center gap-2">
                <button
                  onClick={openAdd}
                  className="flex items-center justify-center gap-2 bg-blue-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
                >
                  <Plus size={14} />
                  Add Supplier
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 text-left border-b border-slate-100">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Supplier Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Contact</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Address</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Notes</th>
                  {canWrite && (
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                  : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={canWrite ? 5 : 4} className="px-5 py-16 text-center">
                        <FileText size={32} className="text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium text-sm">
                          {items.length === 0
                            ? 'No suppliers in the database yet.'
                            : 'No suppliers match your search.'}
                        </p>
                      </td>
                    </tr>
                  )
                  : filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-slate-800 font-semibold text-sm">{item.name}</p>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 text-sm">
                        {item.email && <div className="text-blue-600">{item.email}</div>}
                        {item.phone && <div className="text-slate-500 text-xs">{item.phone}</div>}
                        {!item.email && !item.phone && <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 text-sm">
                        {[item.street_name, item.city, item.zip_code].filter(Boolean).join(', ') || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-xs max-w-[200px] truncate">
                        {item.notes ?? <span className="text-slate-300">—</span>}
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEdit(item)}
                              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors font-medium border border-slate-200"
                            >
                              <Pencil size={11} /> Edit
                            </button>
                            <button
                              onClick={() => setDeleteTarget(item)}
                              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium border border-red-100"
                            >
                              <Trash2 size={11} /> Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            onClick={() => { if (!formLoading) setShowModal(false); }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold text-slate-800">
                {editItem ? 'Edit Supplier' : 'Add Supplier'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                disabled={formLoading}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <p>{formError}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. Acme Build Supplies"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    className={inputCls}
                    placeholder="contact@acme.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    className={inputCls}
                    placeholder="020 1234 5678"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Street Address
                </label>
                <input
                  type="text"
                  value={form.street_name}
                  onChange={(e) => setForm(f => ({ ...f, street_name: e.target.value }))}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    City
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    Postcode
                  </label>
                  <input
                    type="text"
                    value={form.zip_code}
                    onChange={(e) => setForm(f => ({ ...f, zip_code: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  className={`${inputCls} resize-none min-h-[80px]`}
                  placeholder="Any additional information…"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 sticky bottom-0 z-10">
              <button
                onClick={() => setShowModal(false)}
                disabled={formLoading}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={formLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors min-w-[100px] flex justify-center disabled:opacity-50"
              >
                {formLoading ? <span className="animate-pulse">Saving…</span> : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ──────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete Supplier?</h3>
            <p className="text-slate-600 text-sm mb-6">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {deleteLoading && <div className="animate-spin w-3 h-3 border-2 border-white/20 border-t-white rounded-full" />}
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
