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
  active_build:   { label: 'Active Build',   className: 'bg-blue-100 text-blue-700'  },
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

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500';

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
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
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

// ─── Set Slide-Over Panel ─────────────────────────────────────────────────────

interface SetSlideOverProps {
  initial?: Partial<ProductionSet>;
  existingSetNumbers: string[];
  production: { start_date: string | null; end_date: string | null };
  onSave: (data: Partial<ProductionSet>) => Promise<void>;
  onClose: () => void;
  title: string;
}

function SetSlideOver({ initial = {}, existingSetNumbers, production, onSave, onClose, title }: SetSlideOverProps) {
  const [form, setForm] = useState({
    set_number:        initial.set_number        ?? '',
    set_name:          initial.set_name          ?? '',
    shoot_week:        initial.shoot_week         ?? '',
    handover_date:     initial.handover_date      ? initial.handover_date.split('T')[0] : '',
    completion_status: initial.completion_status  ?? 'not_started' as SetStatus,
    notes:             initial.notes              ?? '',
  });
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [setNumError, setSetNumError] = useState('');
  const [dateError, setDateError]     = useState('');

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const validateSetNumber = () => {
    if (!form.set_number.trim()) { setSetNumError(''); return; }
    const others = existingSetNumbers.filter(n => n !== initial.set_number);
    if (others.includes(form.set_number.trim())) {
      setSetNumError(`Set code "${form.set_number}" already exists in this production`);
    } else {
      setSetNumError('');
    }
  };

  const validateDate = () => {
    if (!form.handover_date) { setDateError(''); return; }
    const d = new Date(form.handover_date);
    if (production.start_date && d < new Date(production.start_date)) {
      setDateError(`Handover date must be on or after production start (${production.start_date.split('T')[0]})`);
    } else if (production.end_date && d > new Date(production.end_date)) {
      setDateError(`Handover date must be on or before production end (${production.end_date.split('T')[0]})`);
    } else {
      setDateError('');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.set_name.trim()) { setError('Set name is required.'); return; }
    if (setNumError || dateError) { setError('Please fix the errors above.'); return; }
    setSaving(true); setError('');
    try {
      await onSave({
        ...form,
        set_number:    form.set_number.trim()    || null,
        shoot_week:    form.shoot_week.trim()    || null,
        handover_date: form.handover_date        || null,
        notes:         form.notes.trim()         || null,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-slate-900 font-semibold text-base">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><X size={18} /></button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Set Code</label>
            <input
              className={`${inputCls} ${setNumError ? 'border-red-400' : ''}`}
              placeholder="S001"
              value={form.set_number}
              onChange={f('set_number')}
              onBlur={validateSetNumber}
            />
            {setNumError && <p className="text-red-500 text-xs mt-1">{setNumError}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Set Name *</label>
            <input className={inputCls} placeholder="Interior Castle Great Hall" value={form.set_name} onChange={f('set_name')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Shoot Week</label>
            <input className={inputCls} placeholder="W/E 18 May" value={form.shoot_week} onChange={f('shoot_week')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Handover Date</label>
            <input
              type="date"
              className={`${inputCls} ${dateError ? 'border-red-400' : ''}`}
              value={form.handover_date}
              onChange={f('handover_date')}
              onBlur={validateDate}
            />
            {dateError && <p className="text-red-500 text-xs mt-1">{dateError}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select className={inputCls} value={form.completion_status} onChange={f('completion_status')}>
              {(Object.keys(SET_STATUS_CONFIG) as SetStatus[]).map(s => (
                <option key={s} value={s}>{SET_STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea rows={3} className={`${inputCls} resize-none`} placeholder="Optional notes…" value={form.notes} onChange={f('notes')} />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
          <button
            onClick={submit as unknown as React.MouseEventHandler}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            <Save size={14} />
            Save Set
          </button>
        </div>
      </div>
    </>
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
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
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
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
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
  const [slideOver, setSlideOver]     = useState<'add' | ProductionSet | null>(null);
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null);
  const [patchingSetId, setPatchingSetId] = useState<string | null>(null);

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
    setProduction(p => p ? { ...p, sets: [...p.sets, newSet], total_sets: (p.total_sets ?? 0) + 1 } : p);
    setSlideOver(null);
  };

  const handleUpdateSet = async (setId: string, data: Partial<ProductionSet>) => {
    const updated = await productionsApi.updateSet(id, setId, data);
    setProduction(p => p ? { ...p, sets: p.sets.map(s => s.id === setId ? { ...s, ...updated } : s) } : p);
    setSlideOver(null);
  };

  const handlePatchStatus = async (setId: string, completion_status: string) => {
    setPatchingSetId(setId);
    try {
      const updated = await productionsApi.patchSet(id, setId, completion_status);
      setProduction(p => p ? { ...p, sets: p.sets.map(s => s.id === setId ? { ...s, ...updated } : s) } : p);
    } catch { /* ignore */ } finally {
      setPatchingSetId(null);
    }
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
          <Loader2 size={28} className="animate-spin text-blue-600" />
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
          <button onClick={() => router.back()} className="mt-4 text-blue-600 text-sm hover:underline">← Go back</button>
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
          <CheckCircle2 size={15} className="text-blue-400" />
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
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${state ? 'bg-blue-600 border-blue-600' : 'border-slate-300 group-hover:border-blue-400'}`}
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
                    <p className={`text-xs mt-1 ${rollbackReason.length >= 20 ? 'text-blue-600' : 'text-slate-400'}`}>
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
                  className={`flex items-center gap-2 px-5 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50 transition-colors ${showTransitionModal === 'rollback' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
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
            className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 text-sm transition-colors mt-0.5"
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
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
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
                className="flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-700 bg-blue-50 text-sm rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-60"
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
                <div className="h-2 bg-blue-500 rounded-full transition-all" style={{ width: `${donePct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Set Tracker */}
        {slideOver && (
          <SetSlideOver
            initial={slideOver === 'add' ? {} : slideOver}
            existingSetNumbers={production.sets.map(s => s.set_number).filter(Boolean) as string[]}
            production={production}
            onSave={slideOver === 'add' ? handleAddSet : data => handleUpdateSet((slideOver as ProductionSet).id, data)}
            onClose={() => setSlideOver(null)}
            title={slideOver === 'add' ? 'Add Set' : 'Edit Set'}
          />
        )}

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
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />&gt;14d</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />7–14d</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />&lt;7d / Overdue</span>
              </div>
              {canEdit && !isArchived && (
                <button
                  onClick={() => setSlideOver('add')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={12} />
                  Add Set
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            {production.sets.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-400 text-sm">
                No sets added yet. Click &quot;Add Set&quot; to create the first one.
              </div>
            ) : (() => {
              // Group by shoot_week, order: earliest by handover_date within each group
              const groups: Record<string, typeof production.sets> = {};
              const sorted = [...production.sets].sort((a, b) => {
                if (!a.handover_date) return 1;
                if (!b.handover_date) return -1;
                return new Date(a.handover_date).getTime() - new Date(b.handover_date).getTime();
              });
              sorted.forEach(s => {
                const key = s.shoot_week ?? '__none__';
                if (!groups[key]) groups[key] = [];
                groups[key].push(s);
              });
              const groupKeys = Object.keys(groups).sort((a, b) => {
                if (a === '__none__') return 1;
                if (b === '__none__') return -1;
                return a.localeCompare(b);
              });

              return (
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-5 py-2.5 text-xs font-semibold text-slate-500 sticky left-0 bg-slate-50 z-10">Set #</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Set Name</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Handover</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Countdown</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Status</th>
                      {canEdit && !isArchived && <th className="px-4 py-2.5 text-xs font-semibold text-slate-500"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {groupKeys.map(gk => (
                      <>
                        {/* Shoot week group header */}
                        <tr key={`grp-${gk}`} className="bg-slate-50/80">
                          <td colSpan={canEdit && !isArchived ? 6 : 5} className="px-5 py-2">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              {gk === '__none__' ? 'No Shoot Week' : `Shoot Week: ${gk}`}
                            </span>
                            <span className="ml-2 text-xs text-slate-400">{groups[gk].length} set{groups[gk].length !== 1 ? 's' : ''}</span>
                          </td>
                        </tr>

                        {groups[gk].map(s => {
                          const days = s.days_until_handover;
                          const isHandedOver = s.completion_status === 'handed_over';
                          const isDone = ['complete', 'handed_over'].includes(s.completion_status);
                          const isOverdue = !isHandedOver && days != null && days <= 0;
                          const isRed    = !isDone && days != null && days < 7;
                          const isAmber  = !isDone && days != null && days >= 7 && days <= 14;

                          const rowBg = isHandedOver ? '' : isRed || isOverdue ? 'bg-red-50/60' : isAmber ? 'bg-amber-50/50' : '';
                          const countdownText = isHandedOver
                            ? 'Handed over'
                            : days == null ? '—'
                            : days <= 0 ? 'Overdue'
                            : `${days}d`;
                          const countdownCls = isHandedOver ? 'text-green-600 font-medium' : isOverdue || isRed ? 'text-red-600 font-bold' : isAmber ? 'text-amber-600 font-semibold' : 'text-green-600';
                          const dotColor = isHandedOver ? 'bg-slate-300' : isRed || isOverdue ? 'bg-red-500' : isAmber ? 'bg-amber-400' : 'bg-green-400';
                          const isLinked = (s.linked_po_count ?? 0) > 0;

                          return (
                            <tr key={s.id} className={`border-t border-slate-100 ${rowBg} transition-colors`}>
                              <td className="px-5 py-3 text-slate-500 text-xs font-mono sticky left-0 bg-inherit z-10">{s.set_number ?? '—'}</td>
                              <td className="px-4 py-3">
                                <p className="text-slate-800 font-medium text-sm">{s.set_name}</p>
                                {s.notes && <p className="text-slate-400 text-xs mt-0.5">{s.notes}</p>}
                              </td>
                              <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                                {s.handover_date ? (
                                  <div className="flex items-center gap-1.5">
                                    <MapPin size={11} className="text-slate-400" />
                                    {fmtDate(s.handover_date)}
                                  </div>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                                  <span className={`text-sm ${countdownCls}`}>{countdownText}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {canEdit && !isArchived ? (
                                  <div className="relative">
                                    <select
                                      value={s.completion_status}
                                      disabled={patchingSetId === s.id}
                                      onChange={e => handlePatchStatus(s.id, e.target.value)}
                                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer disabled:opacity-60 pr-6"
                                    >
                                      {(Object.keys(SET_STATUS_CONFIG) as SetStatus[]).map(st => (
                                        <option key={st} value={st}>{SET_STATUS_CONFIG[st].label}</option>
                                      ))}
                                    </select>
                                    {patchingSetId === s.id && <Loader2 size={11} className="animate-spin text-blue-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />}
                                  </div>
                                ) : (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(SET_STATUS_CONFIG[s.completion_status] ?? SET_STATUS_CONFIG.not_started).className}`}>
                                    {(SET_STATUS_CONFIG[s.completion_status] ?? SET_STATUS_CONFIG.not_started).label}
                                  </span>
                                )}
                              </td>
                              {canEdit && !isArchived && (
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => setSlideOver(s)}
                                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Edit set"
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <span title={isLinked ? 'This set has linked purchase orders or timesheet entries.' : undefined}>
                                      <button
                                        onClick={() => handleDeleteSet(s.id)}
                                        disabled={deletingSetId === s.id || isLinked}
                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        {deletingSetId === s.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                      </button>
                                    </span>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </>
                    ))}
                  </tbody>
                </table>
              );
            })()}
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
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
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
                    className="text-blue-600 text-xs hover:text-blue-700 hover:underline font-medium"
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
