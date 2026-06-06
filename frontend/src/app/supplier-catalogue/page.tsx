'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { supplierCatalogueApi, type SupplierCatalogueItem } from '@/lib/api';
import {
  Plus,
  Search,
  X,
  Loader2,
  AlertCircle,
  Upload,
  Pencil,
  Trash2,
  FileText,
  CheckCircle2,
  Download,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtGBP = (n: number | string | null | undefined) =>
  '£' + parseFloat(String(n || 0)).toFixed(2);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const inputCls =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500';

// ─── Types ─────────────────────────────────────────────────────────────────────
type FormData = {
  supplier_name: string;
  product_description: string;
  unit_of_measure: string;
  unit_price: string;
  notes: string;
};

const EMPTY_FORM: FormData = {
  supplier_name: '',
  product_description: '',
  unit_of_measure: '',
  unit_price: '',
  notes: '',
};

// ─── Skeleton row ──────────────────────────────────────────────────────────────
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

// ─── Toast ─────────────────────────────────────────────────────────────────────
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

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function SupplierCataloguePage() {
  const { user } = useAuth();
  const role = user?.role ?? '';

  const isCoordinator = role === 'construction_coordinator';
  const canWrite = isCoordinator; // MD + Accountant are read-only per spec
  const isReadOnly = !canWrite;

  // ── Data state ──
  const [items, setItems] = useState<SupplierCatalogueItem[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Filter state ──
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');

  // ── Add/Edit modal ──
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<SupplierCatalogueItem | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // ── Delete state ──
  const [deleteTarget, setDeleteTarget] = useState<SupplierCatalogueItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── CSV Import modal ──
  const [showImport, setShowImport] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Toast ──
  const [toast, setToast] = useState<string | null>(null);

  // ── Load data ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemList, supplierList] = await Promise.all([
        supplierCatalogueApi.list(),
        supplierCatalogueApi.getSuppliers(),
      ]);
      setItems(itemList);
      setSuppliers(supplierList);
    } catch {
      // silently fail — table shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Filtered + sorted items ──
  const filtered = items
    .filter((item) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        item.supplier_name.toLowerCase().includes(q) ||
        item.product_description.toLowerCase().includes(q);
      const matchSupplier =
        !supplierFilter || item.supplier_name === supplierFilter;
      return matchSearch && matchSupplier;
    })
    .sort((a, b) => a.supplier_name.localeCompare(b.supplier_name));

  // ── Open add modal ──
  function openAdd() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  }

  // ── Open edit modal ──
  function openEdit(item: SupplierCatalogueItem) {
    setEditItem(item);
    setForm({
      supplier_name: item.supplier_name,
      product_description: item.product_description,
      unit_of_measure: item.unit_of_measure,
      unit_price: String(item.unit_price),
      notes: item.notes ?? '',
    });
    setFormError('');
    setShowModal(true);
  }

  // ── Save (create or update) ──
  async function handleSave() {
    setFormError('');
    if (!form.supplier_name.trim()) { setFormError('Supplier name is required.'); return; }
    if (!form.product_description.trim()) { setFormError('Product description is required.'); return; }
    if (!form.unit_of_measure.trim()) { setFormError('Unit of measure is required.'); return; }
    if (!form.unit_price || isNaN(parseFloat(form.unit_price)) || parseFloat(form.unit_price) < 0) {
      setFormError('A valid unit price is required.');
      return;
    }

    setFormLoading(true);
    try {
      const payload: Partial<SupplierCatalogueItem> = {
        supplier_name: form.supplier_name.trim(),
        product_description: form.product_description.trim(),
        unit_of_measure: form.unit_of_measure.trim(),
        unit_price: parseFloat(form.unit_price),
        notes: form.notes.trim() || null,
      };

      if (editItem) {
        await supplierCatalogueApi.update(editItem.id, payload);
        setToast('Entry updated successfully.');
      } else {
        await supplierCatalogueApi.create(payload);
        setToast('Entry added to catalogue.');
      }

      setShowModal(false);
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Save failed. Please try again.');
    } finally {
      setFormLoading(false);
    }
  }

  // ── Delete ──
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await supplierCatalogueApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      setToast('Entry removed from catalogue.');
      await loadData();
    } catch {
      // ignore — item might already be gone
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── CSV Import ──
  async function handleImport() {
    if (!csvFile) { setImportError('Please select a CSV file.'); return; }
    setImportLoading(true);
    setImportError('');
    try {
      const fd = new FormData();
      fd.append('csv', csvFile);
      const result = await supplierCatalogueApi.importCSV(fd);
      setImportResult(result);
      await loadData();
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImportLoading(false);
    }
  }

  function closeImportModal() {
    setShowImport(false);
    setCsvFile(null);
    setImportError('');
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <TopBar
        title="Supplier & Materials Catalogue"
        subtitle={
          loading
            ? 'Loading catalogue…'
            : `${items.length} ${items.length === 1 ? 'entry' : 'entries'} in catalogue`
        }
      />

      <main className="flex-1 p-4 md:p-6 space-y-4">

        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center justify-between px-5 py-4 gap-3">

            {/* Left: search + supplier filter */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 w-64">
                <Search size={14} className="text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search supplier or product…"
                  className="bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none w-full"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Supplier filter dropdown */}
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All suppliers</option>
                {suppliers.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Read-only badge for non-coordinators */}
              {isReadOnly && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full font-medium">
                  Read-only
                </span>
              )}
            </div>

            {/* Right: action buttons */}
            {canWrite && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowImport(true); setImportResult(null); setImportError(''); setCsvFile(null); }}
                  className="flex items-center gap-2 text-sm border border-slate-200 text-slate-600 rounded-lg px-4 py-2 hover:bg-slate-50 transition-colors font-medium"
                >
                  <Upload size={14} />
                  Import CSV
                </button>
                <button
                  onClick={openAdd}
                  className="flex items-center gap-2 bg-blue-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-blue-700 transition-colors font-medium"
                >
                  <Plus size={14} />
                  Add Entry
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 text-left border-b border-slate-100">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Supplier Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Product Description</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Unit of Measure</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right whitespace-nowrap">Unit Price (£)</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Notes</th>
                  {canWrite && (
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading
                  ? Array.from({ length: 7 }).map((_, i) => <SkeletonRow key={i} />)
                  : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={canWrite ? 6 : 5} className="px-5 py-16 text-center">
                        <FileText size={32} className="text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium text-sm">
                          {items.length === 0
                            ? 'No catalogue entries yet — import a CSV or add entries manually.'
                            : 'No entries match your search or filter.'}
                        </p>
                        {canWrite && items.length === 0 && (
                          <div className="flex items-center justify-center gap-2 mt-4">
                            <button
                              onClick={openAdd}
                              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              <Plus size={13} /> Add Entry
                            </button>
                            <span className="text-slate-300">or</span>
                            <button
                              onClick={() => setShowImport(true)}
                              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              <Upload size={13} /> Import CSV
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                  : filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-slate-800 font-semibold text-sm">{item.supplier_name}</p>
                        <p className="text-slate-400 text-[10px] mt-0.5">Updated {fmtDate(item.updated_at)}</p>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 text-sm max-w-[220px]">
                        {item.product_description}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-block text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">
                          {item.unit_of_measure}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-900 font-semibold text-sm text-right whitespace-nowrap">
                        {fmtGBP(item.unit_price)}
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
                              <Pencil size={11} />
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteTarget(item)}
                              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium border border-red-100"
                            >
                              <Trash2 size={11} />
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-slate-400 text-xs">
                Showing {filtered.length} of {items.length} {items.length === 1 ? 'entry' : 'entries'}
                {(search || supplierFilter) ? ' — filtered' : ''}
              </p>
            </div>
          )}
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
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-slate-900 font-semibold text-base">
                  {editItem ? 'Edit Catalogue Entry' : 'Add Catalogue Entry'}
                </h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  {editItem
                    ? `Editing: ${editItem.supplier_name} — ${editItem.product_description}`
                    : 'Add a new supplier product to the price catalogue'}
                </p>
              </div>
              <button
                onClick={() => { if (!formLoading) setShowModal(false); }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">

              {/* Supplier Name with datalist autocomplete */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Supplier Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  list="supplier-list"
                  value={form.supplier_name}
                  onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))}
                  placeholder="e.g. Treeline Timber Co."
                  className={inputCls}
                />
                <datalist id="supplier-list">
                  {suppliers.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              {/* Product Description */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Product Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.product_description}
                  onChange={(e) => setForm((f) => ({ ...f, product_description: e.target.value }))}
                  placeholder="e.g. 18mm Birch Plywood Sheet"
                  className={inputCls}
                />
              </div>

              {/* Unit of Measure + Unit Price side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Unit of Measure <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.unit_of_measure}
                    onChange={(e) => setForm((f) => ({ ...f, unit_of_measure: e.target.value }))}
                    placeholder="e.g. sheet, m², litre"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Unit Price (£) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.unit_price}
                    onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional — e.g. price valid until Dec 2025, minimum order 10 units"
                  className={inputCls + ' resize-none'}
                />
              </div>

              {/* Error */}
              {formError && (
                <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertCircle size={13} />
                  {formError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => { if (!formLoading) setShowModal(false); }}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={formLoading}
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-60"
              >
                {formLoading
                  ? <Loader2 size={14} className="animate-spin" />
                  : editItem
                  ? <Pencil size={14} />
                  : <Plus size={14} />}
                {editItem ? 'Save Changes' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            onClick={() => { if (!deleteLoading) setDeleteTarget(null); }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={18} className="text-red-600" />
                </div>
                <div>
                  <h2 className="text-slate-900 font-semibold text-base">Delete Entry</h2>
                  <p className="text-slate-500 text-xs mt-0.5">This action cannot be undone.</p>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-slate-800 font-medium text-sm">{deleteTarget.supplier_name}</p>
                <p className="text-slate-500 text-xs mt-0.5">{deleteTarget.product_description}</p>
                <p className="text-slate-400 text-xs mt-0.5">{fmtGBP(deleteTarget.unit_price)} per {deleteTarget.unit_of_measure}</p>
              </div>
              <p className="text-slate-500 text-xs">
                Are you sure you want to remove this entry from the catalogue?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => { if (!deleteLoading) setDeleteTarget(null); }}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={deleteLoading}
                onClick={handleDelete}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-60"
              >
                {deleteLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CSV Import Modal ─────────────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            onClick={() => { if (!importLoading) closeImportModal(); }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-slate-900 font-semibold text-base">Import Catalogue CSV</h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  Upload a CSV to bulk-import supplier price entries
                </p>
              </div>
              <button
                onClick={() => { if (!importLoading) closeImportModal(); }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">

              {importResult ? (
                /* Success state */
                <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-green-600" />
                    <p className="text-green-800 font-semibold text-sm">Import complete</p>
                  </div>
                  <p className="text-green-700 text-sm pl-6">
                    <span className="font-bold">{importResult.imported}</span>{' '}
                    {importResult.imported === 1 ? 'item' : 'items'} imported successfully.
                  </p>
                </div>
              ) : (
                <>
                  {/* Template download link */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                    <Download size={13} className="text-blue-500 flex-shrink-0" />
                    <span>
                      Need the correct format?{' '}
                      <a
                        href="/api/supplier-catalogue/template"
                        className="text-blue-600 hover:text-blue-800 font-medium underline"
                      >
                        Download CSV template
                      </a>
                    </span>
                  </div>

                  {/* File drop zone */}
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
                    <Upload size={22} className="text-slate-400 mb-2" />
                    <span className="text-slate-600 text-sm font-medium">
                      {csvFile ? csvFile.name : 'Click to select a CSV file'}
                    </span>
                    {csvFile ? (
                      <span className="text-slate-400 text-xs mt-0.5">
                        {(csvFile.size / 1024).toFixed(1)} KB
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs mt-0.5">CSV files only</span>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setCsvFile(f);
                        setImportError('');
                      }}
                    />
                  </label>

                  {importError && (
                    <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      <AlertCircle size={13} />
                      {importError}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              {importResult ? (
                <button
                  onClick={closeImportModal}
                  className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Done
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { if (!importLoading) closeImportModal(); }}
                    className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!csvFile || importLoading}
                    onClick={handleImport}
                    className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-60"
                  >
                    {importLoading
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Upload size={14} />}
                    Import
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast notification ───────────────────────────────────────────────── */}
      {toast && (
        <Toast message={toast} onClose={() => setToast(null)} />
      )}
    </>
  );
}
