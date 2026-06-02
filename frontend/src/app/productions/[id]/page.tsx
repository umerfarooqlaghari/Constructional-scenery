'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import {
  ArrowLeft, Plus, Pencil, Trash2, X, Loader2, Upload,
  FileText, Calendar, MapPin, Save, Archive, ArchiveRestore, CheckCircle2,
} from 'lucide-react';
import {
  productionsApi,
  ProductionDetail, ProductionSet, ProductionDocument,
  ProductionStatus, ContractType, SetStatus,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ProductionStatus, { label: string; className: string }> = {
  pre_production: { label: 'Pre-Production', className: 'bg-blue-100 text-blue-700' },
  active_build:   { label: 'Active Build',   className: 'bg-teal-100 text-teal-700'  },
  strike:         { label: 'Strike',          className: 'bg-amber-100 text-amber-700' },
  complete:       { label: 'Complete',        className: 'bg-slate-100 text-slate-500' },
  archived:       { label: 'Archived',        className: 'bg-red-100 text-red-500'    },
};

const SET_STATUS_CONFIG: Record<SetStatus, { label: string; className: string }> = {
  not_started:       { label: 'Not Started',       className: 'bg-slate-100 text-slate-400'  },
  in_progress:       { label: 'In Progress',        className: 'bg-blue-100 text-blue-700'   },
  nearing_completion: { label: 'Nearing Completion', className: 'bg-amber-100 text-amber-700' },
  complete:          { label: 'Complete',           className: 'bg-green-100 text-green-700' },
  handed_over:       { label: 'Handed Over',        className: 'bg-slate-100 text-slate-500' },
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500';

// ─── Edit Production Modal ────────────────────────────────────────────────────

interface EditProductionModalProps {
  production: ProductionDetail;
  onClose: () => void;
  onSaved: (updated: ProductionDetail) => void;
}

function EditProductionModal({ production, onClose, onSaved }: EditProductionModalProps) {
  const [form, setForm] = useState({
    name:                production.name ?? '',
    production_company:  production.production_company ?? '',
    production_designer: production.production_designer ?? '',
    production_type:     production.production_type ?? '',
    start_date:          production.start_date ? production.start_date.split('T')[0] : '',
    end_date:            production.end_date   ? production.end_date.split('T')[0]   : '',
    contract_type:       production.contract_type,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const updated = await productionsApi.update(production.id, {
        ...form,
        start_date: form.start_date || null,
        end_date:   form.end_date   || null,
        production_company:  form.production_company  || null,
        production_designer: form.production_designer || null,
        production_type:     form.production_type     || null,
      });
      onSaved({ ...production, ...updated });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-slate-900 font-semibold text-base">Edit Production</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Production Name *</label>
            <input className={inputCls} value={form.name} onChange={set('name')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Production Company</label>
              <input className={inputCls} value={form.production_company} onChange={set('production_company')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Production Designer</label>
              <input className={inputCls} value={form.production_designer} onChange={set('production_designer')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Production Type</label>
              <input className={inputCls} value={form.production_type} onChange={set('production_type')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contract Type</label>
              <select className={inputCls} value={form.contract_type} onChange={set('contract_type')}>
                <option value="on_a_price">On a Price</option>
                <option value="cost_plus">Cost Plus</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
              <input type="date" className={inputCls} value={form.start_date} onChange={set('start_date')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
              <input type="date" className={inputCls} value={form.end_date} onChange={set('end_date')} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              <Save size={14} />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Set Form (inline row or modal) ──────────────────────────────────────────

interface SetFormProps {
  initial?: Partial<ProductionSet>;
  onSave: (data: Partial<ProductionSet>) => Promise<void>;
  onCancel: () => void;
}

function SetForm({ initial = {}, onSave, onCancel }: SetFormProps) {
  const [form, setForm] = useState({
    set_number:       initial.set_number       ?? '',
    set_name:         initial.set_name         ?? '',
    shoot_week:       initial.shoot_week        ?? '',
    handover_date:    initial.handover_date     ? initial.handover_date.split('T')[0] : '',
    completion_status: initial.completion_status ?? 'not_started' as SetStatus,
    notes:            initial.notes            ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.set_name.trim()) { setError('Set name is required.'); return; }
    setSaving(true); setError('');
    try {
      await onSave({
        ...form,
        set_number:    form.set_number    || null,
        shoot_week:    form.shoot_week    || null,
        handover_date: form.handover_date || null,
        notes:         form.notes         || null,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Set #</label>
          <input className={inputCls} placeholder="S001" value={form.set_number} onChange={set('set_number')} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1">Set Name *</label>
          <input className={inputCls} placeholder="Interior Castle Great Hall" value={form.set_name} onChange={set('set_name')} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Shoot Week</label>
          <input className={inputCls} placeholder="W/E 18 May" value={form.shoot_week} onChange={set('shoot_week')} />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Handover Date</label>
          <input type="date" className={inputCls} value={form.handover_date} onChange={set('handover_date')} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
          <select className={inputCls} value={form.completion_status} onChange={set('completion_status')}>
            {(Object.keys(SET_STATUS_CONFIG) as SetStatus[]).map(s => (
              <option key={s} value={s}>{SET_STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
          <input className={inputCls} placeholder="Optional notes" value={form.notes} onChange={set('notes')} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          Save Set
        </button>
      </div>
    </form>
  );
}

// ─── Document Upload Modal ────────────────────────────────────────────────────

interface UploadDocModalProps {
  productionId: string;
  onClose: () => void;
  onUploaded: (doc: ProductionDocument) => void;
}

function UploadDocModal({ productionId, onClose, onUploaded }: UploadDocModalProps) {
  const [file, setFile]         = useState<File | null>(null);
  const [docType, setDocType]   = useState('other');
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError('Please select a file.'); return; }
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('document_type', docType);
      const doc = await productionsApi.uploadDocument(productionId, fd);
      onUploaded(doc);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-slate-900 font-semibold text-base">Upload Document</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Document Type</label>
            <select
              className={inputCls}
              value={docType}
              onChange={e => setDocType(e.target.value)}
            >
              <option value="contract">Contract</option>
              <option value="schedule">Schedule</option>
              <option value="budget">Budget</option>
              <option value="design">Design</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">File</label>
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-colors">
              <Upload size={20} className="text-slate-400 mb-1" />
              <span className="text-sm text-slate-500">{file ? file.name : 'Click to select file'}</span>
              <span className="text-xs text-slate-400 mt-0.5">PDF, DOC, XLS, PNG, JPG</span>
              <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors"
            >
              {uploading && <Loader2 size={14} className="animate-spin" />}
              Upload
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductionDetailPage() {
  const params  = useParams<{ id: string }>();
  const router  = useRouter();
  const { user } = useAuth();
  const isMD         = user?.role === 'managing_director';
  const isAccountant = user?.role === 'construction_accountant';
  const canEdit      = !isAccountant;
  const canArchive   = isMD || isAccountant;
  const id           = params.id;

  const [production, setProduction]   = useState<ProductionDetail | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddSet, setShowAddSet]   = useState(false);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null);

  // Status transition flow
  const STATUS_ORDER = ['pre_production', 'active_build', 'strike', 'complete'] as const;
  type ActiveStatus = typeof STATUS_ORDER[number];
  const NEXT_LABEL: Record<string, string> = {
    pre_production: 'Mark as Active Build',
    active_build:   'Move to Strike',
    strike:         'Mark as Complete',
  };
  const PREV_LABEL: Record<string, string> = {
    active_build: 'Roll back to Pre-Production',
    strike:       'Roll back to Active Build',
    complete:     'Roll back to Strike',
  };
  const nextStatus  = STATUS_ORDER[STATUS_ORDER.indexOf(production?.status as ActiveStatus) + 1];
  const prevStatus  = STATUS_ORDER[STATUS_ORDER.indexOf(production?.status as ActiveStatus) - 1];

  const [showTransitionModal, setShowTransitionModal] = useState<'forward' | 'rollback' | null>(null);
  const [transitionLoading, setTransitionLoading]     = useState(false);
  const [transitionError, setTransitionError]         = useState('');
  // Strike → Complete checklist
  const [checkInvoices, setCheckInvoices]   = useState(false);
  const [checkPayRun, setCheckPayRun]       = useState(false);
  const [checkCostReport, setCheckCostReport] = useState(false);
  // Rollback
  const [rollbackReason, setRollbackReason] = useState('');

  const openTransition = (dir: 'forward' | 'rollback') => {
    setTransitionError('');
    setCheckInvoices(false); setCheckPayRun(false); setCheckCostReport(false);
    setRollbackReason('');
    setShowTransitionModal(dir);
  };

  const handleTransition = async () => {
    if (!production) return;
    const isRollback = showTransitionModal === 'rollback';
    const toStatus   = isRollback ? prevStatus : nextStatus;
    if (!toStatus) return;

    setTransitionLoading(true); setTransitionError('');
    try {
      const { production: updated } = await productionsApi.transitionStatus(id, {
        to_status:             toStatus,
        is_rollback:           isRollback,
        reason:                isRollback ? rollbackReason : undefined,
        checklist_confirmed:   !isRollback && production.status === 'strike' && toStatus === 'complete'
          ? (checkInvoices && checkPayRun && checkCostReport)
          : undefined,
      });
      setProduction(p => p ? { ...p, ...updated } : p);
      setShowTransitionModal(null);
      showToast(isRollback ? `Status rolled back to ${toStatus.replace(/_/g, ' ')}` : `Status advanced to ${toStatus.replace(/_/g, ' ')}`);
    } catch (err: unknown) {
      setTransitionError(err instanceof Error ? err.message : 'Transition failed');
    } finally {
      setTransitionLoading(false);
    }
  };

  // Archive flow
  type ArchivePreview = { production_name: string; po_count: number; timesheet_weeks: number; crew_count: number };
  const [archivePreview, setArchivePreview]   = useState<ArchivePreview | null>(null);
  const [archiveTyped, setArchiveTyped]       = useState('');
  const [archiveLoading, setArchiveLoading]   = useState(false);
  const [archiveError, setArchiveError]       = useState('');
  const [unarchiveLoading, setUnarchiveLoading] = useState(false);
  const [toast, setToast]                     = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const openArchiveModal = async () => {
    try {
      const preview = await productionsApi.archivePreview(id);
      setArchivePreview(preview);
      setArchiveTyped('');
      setArchiveError('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cannot archive this production');
    }
  };

  const handleArchiveConfirm = async () => {
    setArchiveLoading(true); setArchiveError('');
    try {
      await productionsApi.archive(id);
      setArchivePreview(null);
      showToast(`${production?.name} has been archived`);
      setTimeout(() => router.push('/productions'), 1500);
    } catch (err: unknown) {
      setArchiveError('Archive failed. Please try again.');
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleUnarchive = async () => {
    if (!confirm(`Restore "${production?.name}" to active productions?`)) return;
    setUnarchiveLoading(true);
    try {
      const { production: updated } = await productionsApi.unarchive(id);
      setProduction(p => p ? { ...p, ...updated } : p);
      showToast(`${updated.name} has been restored`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Unarchive failed');
    } finally {
      setUnarchiveLoading(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await productionsApi.getById(id);
      setProduction(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load production');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleAddSet = async (data: Partial<ProductionSet>) => {
    const newSet = await productionsApi.createSet(id, data);
    setProduction(p => p ? { ...p, sets: [...p.sets, newSet] } : p);
    setShowAddSet(false);
  };

  const handleUpdateSet = async (setId: string, data: Partial<ProductionSet>) => {
    const updated = await productionsApi.updateSet(id, setId, data);
    setProduction(p => p ? { ...p, sets: p.sets.map(s => s.id === setId ? updated : s) } : p);
    setEditingSetId(null);
  };

  const handleDeleteSet = async (setId: string) => {
    if (!confirm('Delete this set?')) return;
    setDeletingSetId(setId);
    try {
      await productionsApi.deleteSet(id, setId);
      setProduction(p => p ? { ...p, sets: p.sets.filter(s => s.id !== setId) } : p);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingSetId(null);
    }
  };

  if (loading) {
    return (
      <>
        <TopBar title="Production" subtitle="Loading…" />
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-teal-600" />
        </main>
      </>
    );
  }

  if (error || !production) {
    return (
      <>
        <TopBar title="Production" subtitle="Error" />
        <main className="flex-1 p-4 md:p-6">
          <p className="text-red-600">{error || 'Production not found.'}</p>
          <button onClick={() => router.back()} className="mt-4 text-teal-600 text-sm hover:underline">← Go back</button>
        </main>
      </>
    );
  }

  const sc         = STATUS_CONFIG[production.status] ?? STATUS_CONFIG.pre_production;
  const isArchived = production.status === 'archived';
  const donePct    = production.total_sets > 0
    ? Math.round((production.completed_sets / production.total_sets) * 100)
    : 0;
  const archiveConfirmed = archiveTyped.toLowerCase() === (archivePreview?.production_name ?? '').toLowerCase();

  return (
    <>
      {showEditModal && canEdit && !isArchived && (
        <EditProductionModal
          production={production}
          onClose={() => setShowEditModal(false)}
          onSaved={updated => { setProduction(updated); setShowEditModal(false); }}
        />
      )}
      {showUploadModal && !isArchived && (
        <UploadDocModal
          productionId={id}
          onClose={() => setShowUploadModal(false)}
          onUploaded={doc => {
            setProduction(p => p ? { ...p, production_documents: [doc, ...p.production_documents] } : p);
            setShowUploadModal(false);
          }}
        />
      )}

      {/* Archive Confirmation Modal */}
      {archivePreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-2 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <Archive size={18} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-slate-900 font-semibold text-base">Archive this production?</h2>
                <p className="text-slate-500 text-sm mt-1">
                  Archiving <span className="font-bold text-slate-800">{archivePreview.production_name}</span> will
                  hide it from all active views. All data, documents, and reports will be preserved in full and
                  accessible from the archived productions list.
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="mx-6 my-4 bg-slate-50 rounded-xl p-4">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">This production has</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-bold text-slate-800">{archivePreview.po_count}</p>
                  <p className="text-xs text-slate-500 mt-0.5">purchase orders</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{archivePreview.crew_count}</p>
                  <p className="text-xs text-slate-500 mt-0.5">crew members</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{archivePreview.timesheet_weeks}</p>
                  <p className="text-xs text-slate-500 mt-0.5">weeks of timesheets</p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Type the production name to confirm:</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                placeholder={archivePreview.production_name}
                value={archiveTyped}
                onChange={e => setArchiveTyped(e.target.value)}
                autoFocus
              />
              {archiveError && <p className="text-red-600 text-xs mt-1.5">{archiveError}</p>}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4">
              <button
                onClick={() => { setArchivePreview(null); setArchiveError(''); }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveConfirm}
                disabled={!archiveConfirmed || archiveLoading}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium transition-colors"
              >
                {archiveLoading ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                Archive production
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          <CheckCircle2 size={15} className="text-teal-400" />
          {toast}
        </div>
      )}

      {/* Status Transition Modal */}
      {showTransitionModal && production && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-slate-900 font-semibold text-base">
                {showTransitionModal === 'rollback'
                  ? PREV_LABEL[production.status]
                  : NEXT_LABEL[production.status]}
              </h2>
              <button onClick={() => setShowTransitionModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Strike → Complete checklist */}
              {showTransitionModal === 'forward' && production.status === 'strike' && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 font-medium">Confirm all items before marking as Complete:</p>
                  {[
                    { state: checkInvoices, set: setCheckInvoices, label: 'All invoices received and reconciled' },
                    { state: checkPayRun,   set: setCheckPayRun,   label: 'Final pay run processed' },
                    { state: checkCostReport, set: setCheckCostReport, label: 'Cost report reviewed and signed off' },
                  ].map(({ state, set, label }) => (
                    <label key={label} className="flex items-center gap-3 cursor-pointer group">
                      <div
                        onClick={() => set(s => !s)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${state ? 'bg-teal-600 border-teal-600' : 'border-slate-300 group-hover:border-teal-400'}`}
                      >
                        {state && <CheckCircle2 size={12} className="text-white" />}
                      </div>
                      <span className="text-sm text-slate-700">{label}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Simple forward confirmation */}
              {showTransitionModal === 'forward' && production.status !== 'strike' && (
                <p className="text-sm text-slate-600">
                  Move <span className="font-semibold text-slate-800">{production.name}</span> to{' '}
                  <span className="font-semibold text-slate-800">{nextStatus?.replace(/_/g, ' ')}</span>?
                </p>
              )}

              {/* Rollback reason */}
              {showTransitionModal === 'rollback' && (
                <div className="space-y-3">
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Rolling back status is irreversible in spirit — all linked records for the period remain. A clear reason is required.
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Reason <span className="text-slate-400">(min 20 characters)</span>
                    </label>
                    <textarea
                      rows={3}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                      placeholder="Explain why the status is being rolled back..."
                      value={rollbackReason}
                      onChange={e => setRollbackReason(e.target.value)}
                      autoFocus
                    />
                    <p className={`text-xs mt-1 ${rollbackReason.length >= 20 ? 'text-teal-600' : 'text-slate-400'}`}>
                      {rollbackReason.length}/20 characters
                    </p>
                  </div>
                </div>
              )}

              {transitionError && (
                <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{transitionError}</p>
              )}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={() => setShowTransitionModal(null)}
                  className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransition}
                  disabled={
                    transitionLoading ||
                    (showTransitionModal === 'forward' && production.status === 'strike' && !(checkInvoices && checkPayRun && checkCostReport)) ||
                    (showTransitionModal === 'rollback' && rollbackReason.trim().length < 20)
                  }
                  className={`flex items-center gap-2 px-5 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50 transition-colors ${showTransitionModal === 'rollback' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-teal-600 hover:bg-teal-700'}`}
                >
                  {transitionLoading && <Loader2 size={14} className="animate-spin" />}
                  {showTransitionModal === 'rollback' ? 'Confirm Rollback' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <TopBar title={production.name} subtitle={`${production.production_company ?? ''} · ${sc.label}`} />
      <main className="flex-1 p-4 md:p-6 space-y-4 md:space-y-5">

        {/* Archived read-only banner */}
        {isArchived && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <Archive size={16} className="text-amber-600 flex-shrink-0" />
            <p className="text-amber-800 text-sm font-medium flex-1">
              This production is archived. All data is read-only.
            </p>
          </div>
        )}

        {/* Rollback notice banner */}
        {production.rollback_notice && !isArchived && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-orange-500 text-lg leading-none mt-0.5">⚠</span>
            <div>
              <p className="text-orange-800 text-sm font-medium">This production&apos;s status was rolled back</p>
              <p className="text-orange-700 text-xs mt-0.5">{production.rollback_notice}</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <button
            onClick={() => router.push('/productions')}
            className="flex items-center gap-1.5 text-slate-500 hover:text-teal-600 text-sm transition-colors mt-0.5"
          >
            <ArrowLeft size={15} />
            All Productions
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && !isArchived && (
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Pencil size={13} />
                Edit
              </button>
            )}
            {/* Advance status */}
            {!isArchived && nextStatus && NEXT_LABEL[production.status] && (
              <button
                onClick={() => openTransition('forward')}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors font-medium"
              >
                {NEXT_LABEL[production.status]}
              </button>
            )}
            {/* Roll back (MD only) */}
            {isMD && !isArchived && prevStatus && PREV_LABEL[production.status] && (
              <button
                onClick={() => openTransition('rollback')}
                className="flex items-center gap-2 px-4 py-2 border border-orange-200 text-orange-700 bg-orange-50 text-sm rounded-lg hover:bg-orange-100 transition-colors text-xs"
              >
                Roll back
              </button>
            )}
            {/* Archive */}
            {canArchive && production.status === 'complete' && (
              <button
                onClick={openArchiveModal}
                className="flex items-center gap-2 px-4 py-2 border border-amber-200 text-amber-700 bg-amber-50 text-sm rounded-lg hover:bg-amber-100 transition-colors"
              >
                <Archive size={13} />
                Archive
              </button>
            )}
            {/* Unarchive */}
            {isMD && isArchived && (
              <button
                onClick={handleUnarchive}
                disabled={unarchiveLoading}
                className="flex items-center gap-2 px-4 py-2 border border-teal-200 text-teal-700 bg-teal-50 text-sm rounded-lg hover:bg-teal-100 transition-colors disabled:opacity-60"
              >
                {unarchiveLoading ? <Loader2 size={13} className="animate-spin" /> : <ArchiveRestore size={13} />}
                Unarchive
              </button>
            )}
          </div>
        </div>

        {/* Info card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h1 className="text-slate-900 text-xl font-bold">{production.name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sc.className}`}>{sc.label}</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${production.contract_type === 'cost_plus' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
              {production.contract_type === 'cost_plus' ? 'Cost Plus' : 'On a Price'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              { label: 'Production Company', value: production.production_company },
              { label: 'Production Designer', value: production.production_designer },
              { label: 'Production Type', value: production.production_type },
              { label: 'Sets Outstanding', value: String(production.sets_outstanding ?? 0) },
              {
                label: 'Start Date',
                value: fmtDate(production.start_date),
                icon: <Calendar size={13} className="inline mr-1 text-slate-400" />,
              },
              {
                label: 'End Date',
                value: fmtDate(production.end_date),
                icon: <Calendar size={13} className="inline mr-1 text-slate-400" />,
              },
              {
                label: 'Days Remaining',
                value: production.days_remaining != null ? `${production.days_remaining}d` : '—',
              },
              { label: 'Sets Progress', value: `${production.completed_sets} / ${production.total_sets}` },
            ].map(item => (
              <div key={item.label}>
                <p className="text-xs text-slate-400 mb-0.5">{item.label}</p>
                <p className="text-slate-700 font-medium">
                  {item.icon}{item.value ?? '—'}
                </p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {production.total_sets > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span>Sets Completion</span>
                <span>{donePct}% ({production.completed_sets}/{production.total_sets})</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="h-2 bg-teal-500 rounded-full transition-all" style={{ width: `${donePct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Set Tracker */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-slate-900 font-semibold text-sm">Set Tracker</h2>
              <p className="text-slate-400 text-xs mt-0.5">
                {production.sets.length} sets · {production.sets_outstanding} outstanding
                {production.days_remaining != null ? ` · ${production.days_remaining}d to final handover` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />{'>'}&thinsp;14d</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />1–14d</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Overdue</span>
              </div>
              {canEdit && !isArchived && (
                <button
                  onClick={() => { setShowAddSet(s => !s); setEditingSetId(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors"
                >
                  <Plus size={12} />
                  Add Set
                </button>
              )}
            </div>
          </div>

          {/* Add set form */}
          {showAddSet && (
            <div className="px-5 py-4 border-b border-slate-100">
              <SetForm
                onSave={handleAddSet}
                onCancel={() => setShowAddSet(false)}
              />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-5 py-2.5 text-xs font-semibold text-slate-500">Set #</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Set Name</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Shoot Week</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Handover</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Status</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-center">Countdown</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {production.sets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400 text-sm">
                      No sets added yet. Click "Add Set" to create the first one.
                    </td>
                  </tr>
                ) : (
                  production.sets.map(s => {
                    if (editingSetId === s.id) {
                      return (
                        <tr key={s.id}>
                          <td colSpan={7} className="px-4 py-3">
                            <SetForm
                              initial={s}
                              onSave={data => handleUpdateSet(s.id, data)}
                              onCancel={() => setEditingSetId(null)}
                            />
                          </td>
                        </tr>
                      );
                    }

                    const days = s.days_until_handover;
                    const isDone = ['complete', 'handed_over'].includes(s.completion_status);
                    const dotColor = isDone ? 'bg-slate-300' : days == null ? 'bg-slate-200' : days <= 0 ? 'bg-red-500' : days <= 14 ? 'bg-amber-400' : 'bg-green-400';
                    const countdownText = isDone ? 'Done' : days == null ? '—' : days <= 0 ? `${Math.abs(days)}d overdue` : `${days}d`;
                    const countdownColor = isDone ? 'text-slate-400' : days == null ? 'text-slate-400' : days <= 0 ? 'text-red-600 font-bold' : days <= 14 ? 'text-amber-600 font-semibold' : 'text-green-600';
                    const ssc = SET_STATUS_CONFIG[s.completion_status] ?? SET_STATUS_CONFIG.not_started;

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 text-slate-500 text-xs font-mono">{s.set_number ?? '—'}</td>
                        <td className="px-4 py-3">
                          <p className="text-slate-800 font-medium text-sm">{s.set_name}</p>
                          {s.notes && <p className="text-slate-400 text-xs mt-0.5">{s.notes}</p>}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{s.shoot_week ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {s.handover_date ? (
                            <div className="flex items-center gap-1.5">
                              <MapPin size={11} className="text-slate-400" />
                              {fmtDate(s.handover_date)}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ssc.className}`}>{ssc.label}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} />
                            <span className={`text-sm ${countdownColor}`}>{countdownText}</span>
                          </div>
                        </td>
                        {canEdit && !isArchived && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => { setEditingSetId(s.id); setShowAddSet(false); }}
                                className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                title="Edit set"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteSet(s.id)}
                                disabled={deletingSetId === s.id}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                                title="Delete set"
                              >
                                {deletingSetId === s.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Documents */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-slate-900 font-semibold text-sm">Production Documents</h2>
              <p className="text-slate-400 text-xs mt-0.5">{production.production_documents.length} document{production.production_documents.length !== 1 ? 's' : ''}</p>
            </div>
            {canEdit && !isArchived && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Upload size={12} />
                Upload
              </button>
            )}
          </div>

          {production.production_documents.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <FileText size={24} className="text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No documents uploaded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {production.production_documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                      <FileText size={14} className="text-slate-500" />
                    </div>
                    <div>
                      <p className="text-slate-800 text-sm font-medium">{doc.file_name}</p>
                      <p className="text-slate-400 text-xs capitalize">{doc.document_type} · {fmtDate(doc.uploaded_at)}</p>
                    </div>
                  </div>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 text-xs hover:text-teal-700 hover:underline font-medium"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </>
  );
}
