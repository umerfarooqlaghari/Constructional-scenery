'use client';

import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import {
  purchaseOrdersApi,
  productionsApi,
  type PurchaseOrder,
  type POStatus,
  type Production,
  type ProductionSet,
} from '@/lib/api';
import {
  Plus,
  Search,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Upload,
  ChevronLeft,
  ChevronRight,
  FileText,
  Pencil,
  SlidersHorizontal,
} from 'lucide-react';

const PAGE_SIZE = 20;

type TabFilter = POStatus | 'all' | 'pending';
const STATUS_TABS: { label: string; value: TabFilter }[] = [
  { label: 'All',               value: 'all' },
  { label: 'Pending Approvals', value: 'pending' },
  { label: 'Draft',             value: 'draft' },
  { label: 'Submitted',         value: 'submitted' },
  { label: 'Invoice Received',  value: 'invoice_received' },
  { label: 'Approved',          value: 'approved' },
];

const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

const STATUS_BADGE: Record<POStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-blue-100 text-blue-700',
  issued: 'bg-blue-100 text-blue-700',
  invoice_received: 'bg-purple-100 text-purple-700',
  approved: 'bg-green-100 text-green-700',
};

const STATUS_LABEL: Record<POStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  issued: 'Issued',
  invoice_received: 'Invoice Received',
  approved: 'Approved',
};

const PAID_FROM_BADGE: Record<string, string> = {
  supplier_account: 'bg-blue-50 text-blue-600',
  arbuthnot_current_account: 'bg-blue-50 text-blue-700',
  charge_card: 'bg-pink-50 text-pink-600',
  pleo_charge_card: 'bg-purple-50 text-purple-600',
};

const PAID_FROM_LABEL: Record<string, string> = {
  supplier_account: 'Supplier Account',
  arbuthnot_current_account: 'Arbuthnot Current',
  charge_card: 'Charge Card',
  pleo_charge_card: 'Pleo Charge Card',
};

function fmt(val: string | number): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(n) ? '£0.00' : `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

const DEPARTMENTS = [
  'Construction',
  'Scenic Art',
  'Metalwork',
  'Plastering / Sculpting',
  'Rigging',
  'Logistics / Transport',
  'Accounts / Admin',
  'Props'
];

type NewPOForm = {
  supplier_name: string;
  supplier_email: string;
  supplier_code: string;
  street_name: string;
  zip_code: string;
  city: string;
  county: string;
  date_of_po: string;
  production_id: string;
  set_code: string;
  account_code: string;
  description: string;
  department: string;
  custom_department: string;
  net_amount: string;
  vat: string;
  gross_amount: string;
  paid_from: string;
};

const EMPTY_FORM: NewPOForm = {
  supplier_name: '',
  supplier_email: '',
  supplier_code: '',
  street_name: '',
  zip_code: '',
  city: '',
  county: '',
  date_of_po: new Date().toISOString().slice(0, 10),
  production_id: '',
  set_code: '',
  account_code: '',
  description: '',
  department: '',
  custom_department: '',
  net_amount: '',
  vat: '',
  gross_amount: '',
  paid_from: 'supplier_account',
};

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-slate-100">
      {Array.from({ length: 14 }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-3 bg-slate-200 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const role = user?.role ?? '';

  const isMD = role === 'managing_director';
  const isCoordinator = role === 'construction_coordinator';
  const isAccountant = role === 'construction_accountant';

  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<TabFilter>(isMD ? 'approved' : 'all');
  const [actionError, setActionError] = useState<{ id: string; msg: string } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [showFilters, setShowFilters] = useState(false);
  const [poFilters, setPoFilters] = useState({
    production_id: '',
    date_from: '',
    date_to: '',
    net_amount_min: '',
    net_amount_max: '',
    gross_amount_min: '',
    gross_amount_max: '',
    set_code: '',
    account_code: '',
    paid_from: '',
    department: '',
  });

  const activeFilterCount = Object.values(poFilters).filter((v) => v !== '').length;

  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState<NewPOForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const [invoiceModal, setInvoiceModal] = useState<{ id: string; poNumber: string } | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');

  const [submitConfirmPO, setSubmitConfirmPO] = useState<PurchaseOrder | null>(null);

  const [editPO, setEditPO] = useState<PurchaseOrder | null>(null);
  const [editForm, setEditForm] = useState<NewPOForm>(EMPTY_FORM);
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Sets cache: production_id → sets
  const [setsCache, setSetsCache] = useState<Record<string, ProductionSet[]>>({});

  const loadSetsForProduction = async (productionId: string) => {
    if (!productionId || setsCache[productionId]) return;
    try {
      const sets = await productionsApi.getSets(productionId);
      setSetsCache(c => ({ ...c, [productionId]: sets }));
    } catch { /* non-critical */ }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (poFilters.production_id)  params.production_id  = poFilters.production_id;
      if (poFilters.date_from)      params.date_from      = poFilters.date_from;
      if (poFilters.date_to)        params.date_to        = poFilters.date_to;
      if (poFilters.net_amount_min) params.net_amount_min = poFilters.net_amount_min;
      if (poFilters.net_amount_max) params.net_amount_max = poFilters.net_amount_max;
      if (poFilters.gross_amount_min) params.amount_min   = poFilters.gross_amount_min;
      if (poFilters.gross_amount_max) params.amount_max   = poFilters.gross_amount_max;
      if (poFilters.set_code)       params.set_code       = poFilters.set_code;
      if (poFilters.account_code)   params.account_code   = poFilters.account_code;
      if (poFilters.paid_from)      params.paid_from      = poFilters.paid_from;
      if (poFilters.department)     params.department     = poFilters.department;

      const [poList, prodList] = await Promise.all([
        purchaseOrdersApi.list(Object.keys(params).length ? params : undefined),
        productionsApi.list(),
      ]);
      setPos(poList);
      setProductions(prodList);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [poFilters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredPos = pos.filter((po) => {
    if (isMD && po.status !== 'approved') return false;
    const matchStatus =
      statusFilter === 'all' ? true :
      statusFilter === 'pending' ? (po.status === 'submitted' || po.status === 'invoice_received') :
      po.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      po.supplier_name.toLowerCase().includes(q) ||
      po.po_number.toLowerCase().includes(q) ||
      (po.description ?? '').toLowerCase().includes(q) ||
      (po.department ?? '').toLowerCase().includes(q);
    const matchDept =
      !poFilters.department ||
      (po.department ?? '').toLowerCase() === poFilters.department.toLowerCase();
    return matchStatus && matchSearch && matchDept;
  });

  const totalPages = Math.max(1, Math.ceil(filteredPos.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagePos = filteredPos.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalPOs = pos.length;
  const approvedSpend = pos
    .filter((p) => p.status === 'approved')
    .reduce((s, p) => s + parseFloat(p.gross_amount || '0'), 0);
  const awaitingAction = pos.filter(
    (p) => p.status === 'submitted' || p.status === 'invoice_received',
  ).length;
  const totalCommitted = pos.reduce((s, p) => s + parseFloat(p.gross_amount || '0'), 0);

  async function handleSubmit(id: string) {
    setActionLoading(id + ':submit');
    setActionError(null);
    try {
      await purchaseOrdersApi.submit(id);
      await loadData();
    } catch (err: unknown) {
      setActionError({ id, msg: err instanceof Error ? err.message : 'Submit failed' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApprove(id: string) {
    setActionLoading(id + ':approve');
    setActionError(null);
    try {
      await purchaseOrdersApi.approve(id);
      await loadData();
    } catch (err: unknown) {
      setActionError({ id, msg: err instanceof Error ? err.message : 'Approval failed' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this draft purchase order?')) return;
    setActionLoading(id + ':delete');
    setActionError(null);
    try {
      await purchaseOrdersApi.delete(id);
      await loadData();
    } catch (err: unknown) {
      setActionError({ id, msg: err instanceof Error ? err.message : 'Delete failed' });
    } finally {
      setActionLoading(null);
    }
  }

  function openEdit(po: PurchaseOrder) {
    setEditPO(po);
    const isStandardDept = po.department && DEPARTMENTS.includes(po.department);
    setEditForm({
      supplier_name:  po.supplier_name,
      supplier_email: po.supplier_email ?? '',
      supplier_code:  (po as unknown as Record<string, string>).supplier_code ?? '',
      street_name:    (po as unknown as Record<string, string>).street_name ?? '',
      zip_code:       (po as unknown as Record<string, string>).zip_code ?? '',
      city:           (po as unknown as Record<string, string>).city ?? '',
      county:         (po as unknown as Record<string, string>).county ?? '',
      date_of_po:     po.date_of_po?.split('T')[0] ?? '',
      production_id:  po.production_id,
      set_code:       po.set_code ?? '',
      account_code:   po.account_code ?? '',
      description:    po.description ?? '',
      department:     isStandardDept ? po.department! : (po.department ? 'Other' : ''),
      custom_department: isStandardDept ? '' : (po.department ?? ''),
      net_amount:     po.net_amount,
      vat:            po.vat,
      gross_amount:   po.gross_amount,
      paid_from:      po.paid_from,
    });
    setEditError('');
  }

  async function handleSaveEdit() {
    if (!editPO) return;
    setEditError('');
    if (!editForm.supplier_name.trim()) { setEditError('Supplier name is required.'); return; }
    if (!editForm.production_id) { setEditError('Production is required.'); return; }
    if (editForm.department === 'Other' && !editForm.custom_department.trim()) { setEditError('Please enter a custom department.'); return; }
    if (!editForm.net_amount) { setEditError('Net amount is required.'); return; }
    if (!editForm.gross_amount) { setEditError('Gross amount is required.'); return; }
    setEditLoading(true);
    try {
      await purchaseOrdersApi.update(editPO.id, {
        supplier_name:  editForm.supplier_name,
        supplier_email: editForm.supplier_email || null,
        supplier_code:  editForm.supplier_code  || null,
        street_name:    editForm.street_name    || null,
        zip_code:       editForm.zip_code       || null,
        city:           editForm.city           || null,
        county:         editForm.county         || null,
        date_of_po:     editForm.date_of_po,
        production_id:  editForm.production_id,
        set_code:       editForm.set_code       || null,
        account_code:   editForm.account_code   || null,
        description:    editForm.description    || null,
        department:     editForm.department === 'Other' ? editForm.custom_department : (editForm.department || null),
        net_amount:     editForm.net_amount,
        vat:            editForm.vat            || '0',
        gross_amount:   editForm.gross_amount,
        paid_from:      editForm.paid_from,
      });
      setEditPO(null);
      await loadData();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to update PO.');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleCreatePO() {
    setFormError('');
    if (!newForm.supplier_name.trim()) { setFormError('Supplier name is required.'); return; }
    if (!newForm.production_id) { setFormError('Production is required.'); return; }
    if (newForm.department === 'Other' && !newForm.custom_department.trim()) { setFormError('Please enter a custom department.'); return; }
    if (!newForm.net_amount) { setFormError('Net amount is required.'); return; }
    if (!newForm.gross_amount) { setFormError('Gross amount is required.'); return; }
    setFormLoading(true);
    try {
      await purchaseOrdersApi.create({
        supplier_name:  newForm.supplier_name,
        supplier_email: newForm.supplier_email  || null,
        supplier_code:  newForm.supplier_code   || null,
        street_name:    newForm.street_name     || null,
        zip_code:       newForm.zip_code        || null,
        city:           newForm.city            || null,
        county:         newForm.county          || null,
        date_of_po:     newForm.date_of_po,
        production_id:  newForm.production_id,
        set_code:       newForm.set_code        || null,
        account_code:   newForm.account_code    || null,
        description:    newForm.description     || null,
        department:     newForm.department === 'Other' ? newForm.custom_department : (newForm.department || null),
        net_amount:     newForm.net_amount,
        vat:            newForm.vat             || '0',
        gross_amount:   newForm.gross_amount,
        paid_from:      newForm.paid_from,
      });
      setShowNewModal(false);
      setNewForm(EMPTY_FORM);
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create PO.');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleAttachInvoice() {
    if (!invoiceModal || !invoiceFile) return;
    setInvoiceError('');
    if (invoiceFile.size > MAX_FILE_BYTES) {
      setInvoiceError(`File too large. Maximum size is ${MAX_FILE_MB}MB. Your file is ${(invoiceFile.size / 1024 / 1024).toFixed(1)}MB.`);
      return;
    }
    setInvoiceLoading(true);
    try {
      const fd = new FormData();
      fd.append('invoice', invoiceFile);
      await purchaseOrdersApi.attachInvoice(invoiceModal.id, fd);
      setInvoiceModal(null);
      setInvoiceFile(null);
      await loadData();
    } catch (err: unknown) {
      setInvoiceError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setInvoiceLoading(false);
    }
  }

  function updateField(field: keyof NewPOForm, value: string) {
    setNewForm((f) => {
      const updated = { ...f, [field]: value };
      if (field === 'net_amount') {
        const net = parseFloat(value) || 0;
        updated.vat = (net * 0.20).toFixed(2);
        updated.gross_amount = (net * 1.20).toFixed(2);
      } else if (field === 'vat') {
        const net = parseFloat(f.net_amount) || 0;
        const vat = parseFloat(value) || 0;
        updated.gross_amount = (net + vat).toFixed(2);
      }
      return updated;
    });
  }

  return (
    <>
      <TopBar title="Purchase Orders" subtitle="Raise, track and approve supplier purchase orders" />
      <main className="flex-1 p-4 md:p-6 space-y-4 md:space-y-5">

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 px-5 py-4 shadow-sm animate-pulse">
                  <div className="h-3 bg-slate-200 rounded w-24 mb-2" />
                  <div className="h-7 bg-slate-200 rounded w-20 mb-1" />
                  <div className="h-2.5 bg-slate-200 rounded w-16" />
                </div>
              ))
            : [
                { label: 'Total POs', value: String(totalPOs), sub: 'all statuses' },
                { label: 'Approved Spend', value: fmt(approvedSpend), sub: 'inc. VAT' },
                { label: 'Awaiting Action', value: String(awaitingAction), sub: 'submitted or invoice received' },
                { label: 'Total Committed', value: fmt(totalCommitted), sub: 'all statuses' },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4 shadow-sm">
                  <p className="text-slate-500 text-xs font-medium">{s.label}</p>
                  <p className="text-slate-900 text-2xl font-bold mt-1">{s.value}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{s.sub}</p>
                </div>
              ))}
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status tabs */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 flex-wrap">
                {STATUS_TABS.filter(tab =>
                !isMD &&
                (tab.value !== 'pending' || isAccountant)
              ).map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => { setStatusFilter(tab.value); setPage(1); }}
                    className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                      statusFilter === tab.value
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {/* Search */}
              <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 w-full sm:w-56">
                <Search size={14} className="text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search PO, supplier, description..."
                  className="bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none w-full"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>
              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors font-medium ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700'
                }`}
              >
                <SlidersHorizontal size={13} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-0.5 bg-blue-600 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
            {isCoordinator && (
              <button
                onClick={() => { setShowNewModal(true); setFormError(''); setNewForm(EMPTY_FORM); }}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
              >
                <Plus size={14} />
                New PO
              </button>
            )}
          </div>

          {/* Advanced Filter Panel */}
          {showFilters && (
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {/* Production */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Production</label>
                  <select
                    value={poFilters.production_id}
                    onChange={e => { setPoFilters(f => ({ ...f, production_id: e.target.value })); setPage(1); }}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">All productions</option>
                    {productions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {/* Date From */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Date From</label>
                  <input
                    type="date"
                    value={poFilters.date_from}
                    onChange={e => { setPoFilters(f => ({ ...f, date_from: e.target.value })); setPage(1); }}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                {/* Date To */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Date To</label>
                  <input
                    type="date"
                    value={poFilters.date_to}
                    onChange={e => { setPoFilters(f => ({ ...f, date_to: e.target.value })); setPage(1); }}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                {/* Set Code */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Set Code</label>
                  <input
                    type="text"
                    value={poFilters.set_code}
                    onChange={e => { setPoFilters(f => ({ ...f, set_code: e.target.value })); setPage(1); }}
                    placeholder="e.g. S003"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                {/* Account Code */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Account Code</label>
                  <input
                    type="text"
                    value={poFilters.account_code}
                    onChange={e => { setPoFilters(f => ({ ...f, account_code: e.target.value })); setPage(1); }}
                    placeholder="e.g. MAT-001"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                {/* Payment Method */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Payment Method</label>
                  <select
                    value={poFilters.paid_from}
                    onChange={e => { setPoFilters(f => ({ ...f, paid_from: e.target.value })); setPage(1); }}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">All methods</option>
                    <option value="supplier_account">Supplier Account</option>
                    <option value="arbuthnot_current_account">Arbuthnot Current</option>
                    <option value="charge_card">Charge Card</option>
                    <option value="pleo_charge_card">Pleo Charge Card</option>
                  </select>
                </div>
                {/* Department */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Department</label>
                  <select
                    value={poFilters.department}
                    onChange={e => { setPoFilters(f => ({ ...f, department: e.target.value })); setPage(1); }}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">All departments</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    <option value="Other">Other / Custom</option>
                  </select>
                </div>
                {/* Net Amount Min */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Net £ Min</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={poFilters.net_amount_min}
                    onChange={e => { setPoFilters(f => ({ ...f, net_amount_min: e.target.value })); setPage(1); }}
                    placeholder="0.00"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                {/* Net Amount Max */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Net £ Max</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={poFilters.net_amount_max}
                    onChange={e => { setPoFilters(f => ({ ...f, net_amount_max: e.target.value })); setPage(1); }}
                    placeholder="0.00"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                {/* Gross Amount Min */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Gross £ Min</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={poFilters.gross_amount_min}
                    onChange={e => { setPoFilters(f => ({ ...f, gross_amount_min: e.target.value })); setPage(1); }}
                    placeholder="0.00"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                {/* Gross Amount Max */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Gross £ Max</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={poFilters.gross_amount_max}
                    onChange={e => { setPoFilters(f => ({ ...f, gross_amount_max: e.target.value })); setPage(1); }}
                    placeholder="0.00"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setPoFilters({ production_id: '', date_from: '', date_to: '', net_amount_min: '', net_amount_max: '', gross_amount_min: '', gross_amount_max: '', set_code: '', account_code: '', paid_from: '', department: '' });
                    setPage(1);
                  }}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                >
                  <X size={12} /> Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Action error banner */}
          {actionError && (
            <div className="mx-5 mt-3 flex items-center justify-between gap-2 text-red-700 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span><AlertCircle size={13} className="inline mr-1" />{actionError.msg}</span>
              <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600"><X size={13} /></button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap sticky left-0 bg-slate-50 z-10">PO Number</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Supplier</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Department</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Production</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Set / Account</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Description</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Net</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">VAT</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Gross</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Paid From</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Invoice</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                  : pagePos.length === 0
                  ? (
                    <tr>
                      <td colSpan={14} className="px-5 py-12 text-center text-slate-400 text-sm">
                        No purchase orders found.
                      </td>
                    </tr>
                  )
                  : pagePos.map((po) => {
                    const busy = actionLoading?.startsWith(po.id + ':');
                    return (
                      <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5 sticky left-0 bg-white z-10 group-hover:bg-slate-50/50">
                          <p className="text-blue-700 font-semibold text-xs font-mono whitespace-nowrap">{po.po_number}</p>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 text-xs whitespace-nowrap">
                          {fmtDate(po.date_of_po)}
                        </td>
                        <td className="px-4 py-3.5 max-w-[160px]">
                          <p className="text-slate-800 font-medium text-sm truncate">{po.supplier_name}</p>
                          {po.supplier_address && (
                            <p className="text-slate-400 text-xs truncate">{po.supplier_address}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 font-medium text-xs whitespace-nowrap">
                          {po.department || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 text-sm whitespace-nowrap">
                          {po.prod_name ?? po.production_id}
                        </td>
                        <td className="px-4 py-3.5">
                          {po.set_code && <p className="text-slate-700 text-xs font-mono">{po.set_code}</p>}
                          {po.account_code && <p className="text-slate-400 text-xs">{po.account_code}</p>}
                          {!po.set_code && !po.account_code && <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 text-xs max-w-[180px] truncate">
                          {po.description ?? '—'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 text-sm text-right font-medium whitespace-nowrap">
                          {fmt(po.net_amount)}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-sm text-right whitespace-nowrap">
                          {fmt(po.vat)}
                        </td>
                        <td className="px-4 py-3.5 text-slate-900 text-sm text-right font-semibold whitespace-nowrap">
                          {fmt(po.gross_amount)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                              PAID_FROM_BADGE[po.paid_from] ?? 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {PAID_FROM_LABEL[po.paid_from] ?? po.paid_from}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {po.invoice_attachment_url ? (() => {
                            // S3 URLs (https://...) are public — open directly.
                            // Legacy local paths (/uploads/...) proxy through Next.js to backend.
                            const url = po.invoice_attachment_url.startsWith('http')
                              ? po.invoice_attachment_url
                              : encodeURI(decodeURI(po.invoice_attachment_url));
                            const name = po.invoice_attachment_name ?? po.invoice_attachment_url.split('/').pop() ?? 'invoice';
                            return (
                              <button
                                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                <CheckCircle2 size={15} className="text-green-500" />
                                <span className="text-xs font-medium">View</span>
                              </button>
                            );
                          })() : (
                            <span title="No invoice attached"><AlertCircle size={16} className="text-orange-400 mx-auto" /></span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                              STATUS_BADGE[po.status] ?? 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {STATUS_LABEL[po.status] ?? po.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Edit: Coordinator (James) only, draft only */}
                            {isCoordinator && po.status === 'draft' && (
                              <button
                                disabled={!!busy}
                                onClick={() => openEdit(po)}
                                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors font-medium disabled:opacity-50"
                              >
                                <Pencil size={11} />
                                Edit
                              </button>
                            )}
                            {/* Submit: Coordinator (James) only, draft only */}
                            {isCoordinator && po.status === 'draft' && (
                              <button
                                disabled={!!busy}
                                onClick={() => {
                                  if (!po.invoice_attachment_url) {
                                    setSubmitConfirmPO(po);
                                  } else {
                                    handleSubmit(po.id);
                                  }
                                }}
                                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium disabled:opacity-50"
                              >
                                {busy && actionLoading === po.id + ':submit'
                                  ? <Loader2 size={11} className="animate-spin" />
                                  : <FileText size={11} />}
                                Submit
                              </button>
                            )}
                            {/* Approve: Accountant (Sarah) only, submitted or invoice_received */}
                            {isAccountant && (po.status === 'submitted' || po.status === 'invoice_received') && (
                              <button
                                disabled={!!busy}
                                onClick={() => handleApprove(po.id)}
                                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-green-50 text-green-700 hover:bg-green-100 transition-colors font-medium disabled:opacity-50"
                              >
                                {busy && actionLoading === po.id + ':approve'
                                  ? <Loader2 size={11} className="animate-spin" />
                                  : <CheckCircle2 size={11} />}
                                Approve
                              </button>
                            )}
                            {/* Attach Invoice: Coordinator + Accountant, any status except draft */}
                            {(isCoordinator || isAccountant) && po.status !== 'draft' && (
                              <button
                                disabled={!!busy}
                                onClick={() => {
                                  setInvoiceModal({ id: po.id, poNumber: po.po_number });
                                  setInvoiceFile(null);
                                  setInvoiceError('');
                                }}
                                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors font-medium disabled:opacity-50"
                              >
                                <Upload size={11} />
                                Invoice
                              </button>
                            )}
                            {/* Delete: Coordinator (James) only, draft only */}
                            {isCoordinator && po.status === 'draft' && (
                              <button
                                disabled={!!busy}
                                onClick={() => handleDelete(po.id)}
                                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium disabled:opacity-50"
                              >
                                {busy && actionLoading === po.id + ':delete'
                                  ? <Loader2 size={11} className="animate-spin" />
                                  : <X size={11} />}
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
            <span className="text-slate-400 text-xs">
              Showing {filteredPos.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filteredPos.length)} of {filteredPos.length} purchase orders
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={safePage <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 text-slate-500 border border-slate-200 rounded-md hover:bg-white disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={13} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pageNum = totalPages <= 5
                  ? i + 1
                  : safePage <= 3
                  ? i + 1
                  : safePage >= totalPages - 2
                  ? totalPages - 4 + i
                  : safePage - 2 + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      pageNum === safePage
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-500 border border-slate-200 hover:bg-white'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 text-slate-500 border border-slate-200 rounded-md hover:bg-white disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* New PO Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowNewModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-slate-900 font-semibold text-base">New Purchase Order</h2>
                <p className="text-slate-400 text-xs mt-0.5">Fill in the details below to raise a new PO</p>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">

              {/* Supplier */}
              <div className="space-y-3">
                <h3 className="text-slate-700 text-xs font-semibold uppercase tracking-wide">Supplier Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Supplier Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={newForm.supplier_name}
                      onChange={(e) => updateField('supplier_name', e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      placeholder="e.g. Treeline Timber Co."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Supplier Code</label>
                    <input
                      type="text"
                      value={newForm.supplier_code}
                      onChange={(e) => updateField('supplier_code', e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      placeholder="e.g. SUP-001"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Supplier Email</label>
                    <input
                      type="email"
                      value={newForm.supplier_email}
                      onChange={(e) => updateField('supplier_email', e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      placeholder="orders@supplier.com"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-3">
                <h3 className="text-slate-700 text-xs font-semibold uppercase tracking-wide">Address</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Street Name</label>
                    <input
                      type="text"
                      value={newForm.street_name}
                      onChange={(e) => updateField('street_name', e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      placeholder="e.g. 12 Industrial Way"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
                    <input
                      type="text"
                      value={newForm.city}
                      onChange={(e) => updateField('city', e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      placeholder="e.g. Manchester"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">County</label>
                    <input
                      type="text"
                      value={newForm.county}
                      onChange={(e) => updateField('county', e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      placeholder="e.g. Greater Manchester"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Zip / Post Code</label>
                    <input
                      type="text"
                      value={newForm.zip_code}
                      onChange={(e) => updateField('zip_code', e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      placeholder="e.g. M1 2AB"
                    />
                  </div>
                </div>
              </div>

              {/* PO Details */}
              <div className="space-y-3">
                <h3 className="text-slate-700 text-xs font-semibold uppercase tracking-wide">PO Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Date of PO</label>
                    <input
                      type="date"
                      value={newForm.date_of_po}
                      onChange={(e) => updateField('date_of_po', e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Production <span className="text-red-500">*</span></label>
                    <select
                      value={newForm.production_id}
                      onChange={(e) => { updateField('production_id', e.target.value); updateField('set_code', ''); loadSetsForProduction(e.target.value); }}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white"
                    >
                      <option value="">Select production…</option>
                      {productions.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Set Code</label>
                    {setsCache[newForm.production_id]?.length ? (
                      <select
                        value={newForm.set_code}
                        onChange={(e) => updateField('set_code', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white"
                      >
                        <option value="">— No set —</option>
                        {setsCache[newForm.production_id].filter(s => s.set_number).map(s => (
                          <option key={s.id} value={s.set_number!}>{s.set_number} — {s.set_name}</option>
                        ))}
                      </select>
                    ) : (
                    <input
                      type="text"
                      value={newForm.set_code}
                      onChange={(e) => updateField('set_code', e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      placeholder="e.g. S003"
                    />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Account Code</label>
                    <input
                      type="text"
                      value={newForm.account_code}
                      onChange={(e) => updateField('account_code', e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      placeholder="e.g. MAT-001"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
                    <select
                      value={newForm.department}
                      onChange={(e) => { updateField('department', e.target.value); if (e.target.value !== 'Other') updateField('custom_department', ''); }}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white"
                    >
                      <option value="">— Select department —</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                      <option value="Other">Other / Custom</option>
                    </select>
                  </div>
                  {newForm.department === 'Other' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Custom Department <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={newForm.custom_department}
                        onChange={(e) => updateField('custom_department', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                        placeholder="Enter department name"
                      />
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                    <textarea
                      value={newForm.description}
                      onChange={(e) => updateField('description', e.target.value)}
                      rows={2}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 resize-none"
                      placeholder="Brief description of goods/services"
                    />
                  </div>
                </div>
              </div>

              {/* Financials */}
              <div className="space-y-3">
                <h3 className="text-slate-700 text-xs font-semibold uppercase tracking-wide">Financials</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Net Amount (£) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newForm.net_amount}
                      onChange={(e) => updateField('net_amount', e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">VAT (£)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newForm.vat}
                      onChange={(e) => updateField('vat', e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Gross Amount (£) <span className="text-slate-400 font-normal">(auto)</span></label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newForm.gross_amount}
                      readOnly
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-slate-50 outline-none cursor-default"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Paid From</label>
                  <select
                    value={newForm.paid_from}
                    onChange={(e) => updateField('paid_from', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white"
                  >
                    <option value="supplier_account">Supplier Account</option>
                    <option value="arbuthnot_current_account">Arbuthnot Current Account</option>
                    <option value="charge_card">Charge Card</option>
                    <option value="pleo_charge_card">Pleo Charge Card</option>
                  </select>
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertCircle size={13} />
                  {formError}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={formLoading}
                onClick={handleCreatePO}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-60"
              >
                {formLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Create PO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attach Invoice Modal */}
      {invoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setInvoiceModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-slate-900 font-semibold text-base">Attach Invoice</h2>
                <p className="text-slate-400 text-xs mt-0.5">{invoiceModal.poNumber}</p>
              </div>
              <button
                onClick={() => setInvoiceModal(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
                <Upload size={22} className="text-slate-400 mb-2" />
                <span className="text-slate-500 text-sm font-medium">
                  {invoiceFile ? invoiceFile.name : 'Click to upload invoice'}
                </span>
                <span className="text-slate-400 text-xs mt-1">PDF, PNG, JPG up to 25MB</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setInvoiceFile(f);
                    setInvoiceError('');
                  }}
                />
              </label>
              {invoiceError && (
                <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertCircle size={13} />
                  {invoiceError}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setInvoiceModal(null)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!invoiceFile || invoiceLoading}
                onClick={handleAttachInvoice}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-60"
              >
                {invoiceLoading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Upload Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit PO Modal — draft only */}
      {editPO && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditPO(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-slate-900 font-semibold text-base">Edit Purchase Order</h2>
                <p className="text-slate-400 text-xs mt-0.5">{editPO.po_number} — Draft</p>
              </div>
              <button onClick={() => setEditPO(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              {editError && (
                <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertCircle size={13} />{editError}
                </div>
              )}
              {/* Supplier */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Supplier Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Supplier Name *</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.supplier_name} onChange={e => setEditForm(f => ({ ...f, supplier_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Supplier Code</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.supplier_code} onChange={e => setEditForm(f => ({ ...f, supplier_code: e.target.value }))} placeholder="e.g. SUP-001" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Supplier Email</label>
                    <input type="email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.supplier_email} onChange={e => setEditForm(f => ({ ...f, supplier_email: e.target.value }))} />
                  </div>
                </div>
              </div>
              {/* Address */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Address</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Street Name</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.street_name} onChange={e => setEditForm(f => ({ ...f, street_name: e.target.value }))} placeholder="e.g. 12 Industrial Way" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} placeholder="e.g. Manchester" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">County</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.county} onChange={e => setEditForm(f => ({ ...f, county: e.target.value }))} placeholder="e.g. Greater Manchester" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Zip / Post Code</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.zip_code} onChange={e => setEditForm(f => ({ ...f, zip_code: e.target.value }))} placeholder="e.g. M1 2AB" />
                  </div>
                </div>
              </div>
              {/* PO Details */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">PO Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                    <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.date_of_po} onChange={e => setEditForm(f => ({ ...f, date_of_po: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Production *</label>
                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.production_id} onChange={e => setEditForm(f => ({ ...f, production_id: e.target.value }))}>
                      <option value="">— Select —</option>
                      {productions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Set Code</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.set_code} onChange={e => setEditForm(f => ({ ...f, set_code: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Account Code</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.account_code} onChange={e => setEditForm(f => ({ ...f, account_code: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={editForm.department}
                      onChange={e => setEditForm(f => ({ ...f, department: e.target.value, custom_department: e.target.value === 'Other' ? f.custom_department : '' }))}
                    >
                      <option value="">— Select department —</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                      <option value="Other">Other / Custom</option>
                    </select>
                  </div>
                  {editForm.department === 'Other' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Custom Department *</label>
                      <input
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm.custom_department}
                        onChange={e => setEditForm(f => ({ ...f, custom_department: e.target.value }))}
                        placeholder="Enter department name"
                      />
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>
              </div>
              {/* Financials */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Financials</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Net (£) *</label>
                    <input type="number" step="0.01" min="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.net_amount} onChange={e => setEditForm(f => {
                      const net = parseFloat(e.target.value) || 0;
                      return { ...f, net_amount: e.target.value, vat: (net * 0.20).toFixed(2), gross_amount: (net * 1.20).toFixed(2) };
                    })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">VAT (£)</label>
                    <input type="number" step="0.01" min="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.vat} onChange={e => setEditForm(f => {
                      const net = parseFloat(f.net_amount) || 0;
                      const vat = parseFloat(e.target.value) || 0;
                      return { ...f, vat: e.target.value, gross_amount: (net + vat).toFixed(2) };
                    })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Gross (£) <span className="text-slate-400 font-normal">(auto)</span></label>
                    <input type="number" step="0.01" min="0" readOnly className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-slate-50 cursor-default" value={editForm.gross_amount} />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Paid From</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={editForm.paid_from} onChange={e => setEditForm(f => ({ ...f, paid_from: e.target.value }))}>
                    <option value="supplier_account">Supplier Account</option>
                    <option value="arbuthnot_current_account">Arbuthnot Current Account</option>
                    <option value="charge_card">Charge Card</option>
                    <option value="pleo_charge_card">Pleo Charge Card</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button onClick={() => setEditPO(null)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-white transition-colors">
                Cancel
              </button>
              <button
                disabled={editLoading}
                onClick={handleSaveEdit}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-60"
              >
                {editLoading ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit without invoice confirmation modal */}
      {submitConfirmPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSubmitConfirmPO(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 pt-6 pb-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 mb-4 mx-auto">
                <AlertCircle size={24} className="text-amber-500" />
              </div>
              <h2 className="text-slate-900 font-semibold text-base text-center">Submit Purchase Order without an invoice</h2>
              <p className="text-slate-500 text-sm text-center mt-2">
                No invoice is attached to <span className="font-medium">{submitConfirmPO.po_number}</span>. Are you sure you want to submit?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setSubmitConfirmPO(null)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const id = submitConfirmPO.id;
                  setSubmitConfirmPO(null);
                  handleSubmit(id);
                }}
                className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
