'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import {
  ArrowLeft, Plus, Pencil, Trash2, X, Loader2, Upload,
  FileText, Calendar, MapPin,
  Save,
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
    status:              production.status,
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
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select className={inputCls} value={form.status} onChange={set('status')}>
              <option value="pre_production">Pre-Production</option>
              <option value="active_build">Active Build</option>
              <option value="strike">Strike</option>
              <option value="complete">Complete</option>
            </select>
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
  const canEdit = user?.role !== 'construction_accountant';
  const id      = params.id;

  const [production, setProduction]   = useState<ProductionDetail | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddSet, setShowAddSet]   = useState(false);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null);

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

  const sc       = STATUS_CONFIG[production.status] ?? STATUS_CONFIG.pre_production;
  const donePct  = production.total_sets > 0
    ? Math.round((production.completed_sets / production.total_sets) * 100)
    : 0;

  return (
    <>
      {showEditModal && canEdit && (
        <EditProductionModal
          production={production}
          onClose={() => setShowEditModal(false)}
          onSaved={updated => { setProduction(updated); setShowEditModal(false); }}
        />
      )}
      {showUploadModal && (
        <UploadDocModal
          productionId={id}
          onClose={() => setShowUploadModal(false)}
          onUploaded={doc => {
            setProduction(p => p ? { ...p, production_documents: [doc, ...p.production_documents] } : p);
            setShowUploadModal(false);
          }}
        />
      )}

      <TopBar title={production.name} subtitle={`${production.production_company ?? ''} · ${sc.label}`} />
      <main className="flex-1 p-4 md:p-6 space-y-4 md:space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <button
            onClick={() => router.push('/productions')}
            className="flex items-center gap-1.5 text-slate-500 hover:text-teal-600 text-sm transition-colors mt-0.5"
          >
            <ArrowLeft size={15} />
            All Productions
          </button>
          {canEdit && (
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Pencil size={13} />
              Edit
            </button>
          )}
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
              {canEdit && (
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
                        {canEdit && (
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
            {canEdit && (
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
