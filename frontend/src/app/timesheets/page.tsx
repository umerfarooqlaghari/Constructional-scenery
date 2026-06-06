'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Loader2,
  Mail, Paperclip, ShieldCheck, X, Plus, ExternalLink, UserX,
} from 'lucide-react';
import {
  timesheetsApi, productionsApi, crewApi,
  Timesheet, TimesheetStatus, Production, GatewayError, CrewMember,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// ─── Inline API helpers ───────────────────────────────────────────────────────

const verifyTimesheet = (id: string) =>
  fetch(`/api/timesheets/${id}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('cs_token')}`,
    },
  }).then(r => r.json());

const attachInvoice = (id: string, formData: FormData) =>
  fetch(`/api/timesheets/${id}/attach-invoice`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('cs_token')}`,
    },
    body: formData,
  }).then(r => r.json());

const chaseInvoices = (production_id: string, week_ending_date: string) =>
  fetch('/api/timesheets/chase-invoices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('cs_token')}`,
    },
    body: JSON.stringify({ production_id, week_ending_date }),
  }).then(r => r.json());

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-blue-500', 'bg-pink-500', 'bg-orange-500',
  'bg-green-500', 'bg-indigo-500', 'bg-rose-500', 'bg-cyan-500', 'bg-amber-500',
];

type TSBadgeDef = { label: string; className: string };
const STATUS_BADGE: Record<TimesheetStatus, TSBadgeDef> = {
  draft:            { label: 'Draft',            className: 'bg-slate-100 text-slate-500' },
  sent:             { label: 'Sent',             className: 'bg-blue-100 text-blue-700' },
  reviewed:         { label: 'Reviewed',         className: 'bg-amber-100 text-amber-700' },
  invoice_received: { label: 'Invoice Received', className: 'bg-purple-100 text-purple-700' },
  verified:         { label: 'Verified',         className: 'bg-green-100 text-green-700' },
};

/** Returns the Sunday on or after the given date */
function nextSunday(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay(); // 0 = Sunday
  const diff = day === 0 ? 0 : 7 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function fmtWeek(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitials(first = '', last = '') {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

const hasInvoice = (status: TimesheetStatus) =>
  status === 'invoice_received' || status === 'verified';

// ─── Attach Invoice Modal ─────────────────────────────────────────────────────

interface AttachInvoiceModalProps {
  timesheetId: string;
  crewName: string;
  onClose: () => void;
  onAttached: () => void;
}

function AttachInvoiceModal({ timesheetId, crewName, onClose, onAttached }: AttachInvoiceModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError('Please select a file.'); return; }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('invoice', file);
      await attachInvoice(timesheetId, fd);
      onAttached();
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
          <h2 className="text-slate-900 font-semibold text-base">Attach Invoice</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <p className="text-slate-500 text-sm">Attaching invoice for <span className="font-medium text-slate-800">{crewName}</span></p>
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Invoice File</label>
            <div
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-lg px-4 py-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
            >
              {file
                ? <p className="text-slate-700 text-sm font-medium">{file.name}</p>
                : <><Paperclip size={20} className="text-slate-300 mx-auto mb-2" /><p className="text-slate-400 text-sm">Click to select PDF or image</p></>}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {uploading && <Loader2 size={14} className="animate-spin" />}
              Upload Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Gateway Error Banner ─────────────────────────────────────────────────────

function GatewayErrorBanner({ gatewayErr, onClose }: { gatewayErr: GatewayError; onClose: () => void }) {
  const router = useRouter();
  const crewProfileUrl = gatewayErr.crew_member_id ? `/crew/${gatewayErr.crew_member_id}` : null;
  const MESSAGES: Record<string, string> = {
    NO_PRODUCTION_ENGAGEMENT: `${gatewayErr.crew_name ?? 'This crew member'} is not engaged on this production. Add them to the production first.`,
    CREW_INACTIVE: `${gatewayErr.crew_name ?? 'This crew member'} is deactivated. Reactivate them in the Crew Database first.`,
    CREW_RECORD_INCOMPLETE: `${gatewayErr.crew_name ?? 'Crew record'} is incomplete — missing: ${gatewayErr.missing_fields?.join(', ')}.`,
    RATE_NOT_CONFIGURED: gatewayErr.error,
    CREW_NOT_FOUND: 'Crew member not found. Register them in the Crew Database.',
  };
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
      <UserX size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-amber-800 text-sm font-medium">Cannot create timesheet</p>
        <p className="text-amber-700 text-xs mt-0.5">{MESSAGES[gatewayErr.error_code] ?? gatewayErr.error}</p>
        {crewProfileUrl && (
          <button onClick={() => router.push(crewProfileUrl)} className="flex items-center gap-1 mt-1.5 text-xs text-blue-600 hover:underline font-medium">
            <ExternalLink size={11} /> Go to crew profile
          </button>
        )}
      </div>
      <button onClick={onClose} className="text-amber-400 hover:text-amber-600 flex-shrink-0"><X size={14} /></button>
    </div>
  );
}

// ─── New Timesheet Modal ──────────────────────────────────────────────────────

function NewTimesheetModal({ productions, weekEndingDate, onClose, onCreated }: {
  productions: Production[]; weekEndingDate: string; onClose: () => void; onCreated: () => void;
}) {
  const [productionId, setProductionId] = useState(productions[0]?.id ?? '');
  const [allCrew, setAllCrew] = useState<CrewMember[]>([]);
  const [crewId, setCrewId]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [gatewayErr, setGatewayErr] = useState<GatewayError | null>(null);

  useEffect(() => { crewApi.list({ is_active: 'true' }).then(setAllCrew).catch(() => {}); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crewId || !productionId) return;
    setSaving(true); setGatewayErr(null);
    try {
      await timesheetsApi.create({ crew_member_id: crewId, production_id: productionId, week_ending_date: weekEndingDate });
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      const codes = ['CREW_NOT_FOUND','CREW_INACTIVE','CREW_RECORD_INCOMPLETE','NO_PRODUCTION_ENGAGEMENT','RATE_NOT_CONFIGURED'] as const;
      const matchCode = codes.find(k => msg.includes(k));
      const crew = allCrew.find(c => c.id === crewId);
      setGatewayErr({ error_code: matchCode ?? 'CREW_NOT_FOUND', error: msg, crew_member_id: crewId, crew_name: crew ? `${crew.first_name} ${crew.last_name}` : undefined });
    } finally { setSaving(false); }
  };

  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div><h2 className="text-slate-900 font-semibold text-sm">New Timesheet</h2><p className="text-slate-400 text-xs mt-0.5">Week ending: {weekEndingDate}</p></div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          {gatewayErr && <GatewayErrorBanner gatewayErr={gatewayErr} onClose={() => setGatewayErr(null)} />}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Production</label>
            <select className={inp} value={productionId} onChange={e => setProductionId(e.target.value)}>
              {productions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Crew Member *</label>
            <select className={inp} value={crewId} onChange={e => setCrewId(e.target.value)}>
              <option value="">— Select crew member —</option>
              {allCrew.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.crew_number}) — {c.crew_trade ?? ''}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
            <button type="submit" disabled={saving || !crewId} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-60">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TimesheetsPage() {
  const { user } = useAuth();
  const canAct = user?.role === 'managing_director' || user?.role === 'construction_accountant';

  // Week state — start on current week-ending Sunday
  const [weekEnding, setWeekEnding] = useState<Date>(() => nextSunday(new Date()));

  // Productions
  const [productions, setProductions]   = useState<Production[]>([]);
  const [selectedProd, setSelectedProd] = useState<string>('');

  // Timesheets
  const [sheets, setSheets]   = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Action states
  const [verifying, setVerifying]   = useState<string | null>(null);
  const [chasing, setChasing]       = useState(false);
  const [chaseMsg, setChaseMsg]     = useState('');
  const [attachModal, setAttachModal] = useState<{ id: string; name: string } | null>(null);

  // Filter state (client-side, applied to the fetched week's data)
  const [statusFilter, setStatusFilter] = useState<TimesheetStatus | 'all'>('all');
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [tradeFilter, setTradeFilter] = useState('');
  const [crewSearch, setCrewSearch] = useState('');
  const [showNewTs, setShowNewTs]   = useState(false);

  // Load productions once
  useEffect(() => {
    productionsApi.list()
      .then(data => {
        setProductions(data);
        if (data.length > 0) setSelectedProd(data[0].id);
      })
      .catch(() => { /* silently ignore */ });
  }, []);

  const weekEndingISO = toISODate(weekEnding);

  const loadSheets = useCallback(async () => {
    if (!selectedProd) return;
    setLoading(true);
    setError('');
    try {
      const data = await timesheetsApi.list({
        production_id:    selectedProd,
        week_ending_date: weekEndingISO,
      });
      setSheets(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load timesheets');
    } finally {
      setLoading(false);
    }
  }, [selectedProd, weekEndingISO]);

  useEffect(() => { loadSheets(); }, [loadSheets]);

  // Week navigation
  const prevWeek = () => setWeekEnding(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  const nextWeek = () => setWeekEnding(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });

  // Available trades for this week's sheets
  const availableTrades = Array.from(new Set(sheets.map(s => s.crew_trade).filter(Boolean))) as string[];

  // Client-side filtered view
  const filteredSheets = sheets.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (invoiceFilter === 'yes' && !hasInvoice(s.status)) return false;
    if (invoiceFilter === 'no' && hasInvoice(s.status)) return false;
    if (tradeFilter && s.crew_trade !== tradeFilter) return false;
    if (crewSearch) {
      const q = crewSearch.toLowerCase();
      const name = `${s.first_name ?? ''} ${s.last_name ?? ''}`.toLowerCase();
      if (!name.includes(q) && !(s.crew_number ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Stats from full unfiltered week data
  const crewOnSheet      = sheets.length;
  const invoicesReceived = sheets.filter(s => hasInvoice(s.status)).length;
  const nonDraftSheets   = sheets.filter(s => s.status !== 'draft');
  const totalNet  = nonDraftSheets.reduce((acc, s) => acc + (s.grand_total ? parseFloat(s.grand_total) : 0), 0);
  const totalGross = totalNet;

  // Verify handler
  const handleVerify = async (id: string) => {
    setVerifying(id);
    try {
      await verifyTimesheet(id);
      await loadSheets();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Verify failed');
    } finally {
      setVerifying(null);
    }
  };

  // Chase invoices handler
  const handleChase = async () => {
    if (!selectedProd) return;
    setChasing(true);
    setChaseMsg('');
    try {
      const res = await chaseInvoices(selectedProd, weekEndingISO);
      setChaseMsg(res?.message ?? 'Chase emails sent.');
    } catch (err: unknown) {
      setChaseMsg(err instanceof Error ? err.message : 'Failed to send chase emails');
    } finally {
      setChasing(false);
    }
  };

  const selectedProdName = productions.find(p => p.id === selectedProd)?.name ?? '';

  return (
    <>
      {showNewTs && (
        <NewTimesheetModal
          productions={productions}
          weekEndingDate={weekEndingISO}
          onClose={() => setShowNewTs(false)}
          onCreated={() => { setShowNewTs(false); loadSheets(); }}
        />
      )}
      {attachModal && (
        <AttachInvoiceModal
          timesheetId={attachModal.id}
          crewName={attachModal.name}
          onClose={() => setAttachModal(null)}
          onAttached={() => { setAttachModal(null); loadSheets(); }}
        />
      )}

      <TopBar title="Timesheets & Pay Run" subtitle="Weekly timesheet review and pay run management" />
      <main className="flex-1 p-4 md:p-6 space-y-4 md:space-y-5">

        {/* Week + Production selectors */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Week selector */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-3 py-2.5 shadow-sm">
              <button
                onClick={prevWeek}
                className="p-0.5 text-slate-400 hover:text-slate-700 transition-colors"
                aria-label="Previous week"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-slate-900 font-semibold text-sm px-2 whitespace-nowrap">
                Week ending: {fmtWeek(weekEnding)}
              </span>
              <button
                onClick={nextWeek}
                className="p-0.5 text-slate-400 hover:text-slate-700 transition-colors"
                aria-label="Next week"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Production selector */}
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 shadow-sm">
              <select
                value={selectedProd}
                onChange={e => setSelectedProd(e.target.value)}
                className="text-slate-900 text-sm font-medium bg-transparent outline-none cursor-pointer pr-2"
              >
                {productions.length === 0 && <option value="">Loading…</option>}
                {productions.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          {canAct && (
            <div className="flex items-center gap-2">
              {chaseMsg && (
                <span className="text-blue-700 text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">{chaseMsg}</span>
              )}
              <button
                onClick={handleChase}
                disabled={chasing || !selectedProd}
                className="flex items-center gap-2 text-slate-600 text-sm border border-slate-200 bg-white rounded-lg px-3 py-2 hover:bg-slate-50 shadow-sm disabled:opacity-60 transition-colors"
              >
                {chasing ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                Chase Invoices
              </button>
              <button
                onClick={() => setShowNewTs(true)}
                disabled={!selectedProd}
                className="flex items-center gap-2 bg-teal-600 text-white text-sm rounded-lg px-3 py-2 hover:bg-teal-700 shadow-sm disabled:opacity-60 transition-colors font-medium"
              >
                <Plus size={14} /> New Timesheet
              </button>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Crew on Sheet',      value: loading ? null : crewOnSheet,                   sub: selectedProdName || 'this production' },
            { label: 'Invoices Received',  value: loading ? null : `${invoicesReceived} / ${crewOnSheet}`, sub: `${crewOnSheet - invoicesReceived} outstanding` },
            { label: 'Total Net',          value: loading ? null : `£${totalNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: 'non-draft timesheets' },
            { label: 'Total Gross',        value: loading ? null : `£${totalGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: 'non-draft timesheets' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4 shadow-sm">
              <p className="text-slate-500 text-xs font-medium">{s.label}</p>
              {s.value === null
                ? <div className="h-7 w-16 bg-slate-100 rounded animate-pulse mt-1 mb-0.5" />
                : <p className="text-slate-900 text-xl font-bold mt-1">{s.value}</p>}
              <p className="text-slate-400 text-xs mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Timesheet table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-slate-900 font-semibold text-sm">
                Timesheets — Week Ending {fmtWeek(weekEnding)}
              </h2>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status tabs */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                {(['all', 'draft', 'sent', 'invoice_received', 'verified'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors capitalize ${
                      statusFilter === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {s === 'all' ? 'All' : s === 'invoice_received' ? 'Invoice Rcvd' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              {/* Invoice toggle */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                {(['all', 'yes', 'no'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setInvoiceFilter(v)}
                    className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                      invoiceFilter === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {v === 'all' ? 'Any Invoice' : v === 'yes' ? 'Invoice ✓' : 'No Invoice'}
                  </button>
                ))}
              </div>
              {/* Trade dropdown */}
              <select
                value={tradeFilter}
                onChange={e => setTradeFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">All trades</option>
                {availableTrades.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {/* Crew search */}
              <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2.5 py-1.5 w-44">
                <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  type="text"
                  value={crewSearch}
                  onChange={e => setCrewSearch(e.target.value)}
                  placeholder="Crew name..."
                  className="bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none w-full"
                />
                {crewSearch && <button onClick={() => setCrewSearch('')} className="text-slate-400 hover:text-slate-600"><X size={11} /></button>}
              </div>
              {/* Clear filters */}
              {(statusFilter !== 'all' || invoiceFilter !== 'all' || tradeFilter || crewSearch) && (
                <button
                  onClick={() => { setStatusFilter('all'); setInvoiceFilter('all'); setTradeFilter(''); setCrewSearch(''); }}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
                >
                  <X size={11} /> Clear
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="px-5 py-4 text-red-600 text-sm bg-red-50 border-b border-red-100">{error}</div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 sticky left-0 bg-slate-50 z-10">Crew Member</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Trade / Rank</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Net</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Invoice</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                  {canAct && <th className="px-4 py-3 text-xs font-semibold text-slate-500">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: canAct ? 6 : 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-4">
                          <div className="h-4 bg-slate-100 rounded animate-pulse w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredSheets.length === 0 ? (
                  <tr>
                    <td colSpan={canAct ? 6 : 5} className="px-5 py-10 text-center text-slate-400 text-sm">
                      {sheets.length === 0 ? 'No timesheets found for this week and production.' : 'No timesheets match the current filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredSheets.map((ts, idx) => {
                    const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                    const badge = STATUS_BADGE[ts.status] ?? STATUS_BADGE.draft;
                    const invoiced = hasInvoice(ts.status);
                    const net = ts.grand_total ? parseFloat(ts.grand_total) : null;
                    const firstName = ts.first_name ?? '';
                    const lastName  = ts.last_name  ?? '';
                    const fullName  = `${firstName} ${lastName}`.trim() || 'Unknown';

                    return (
                      <tr key={ts.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5 sticky left-0 bg-white z-10">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full ${colorClass} flex items-center justify-center flex-shrink-0`}>
                              <span className="text-white text-xs font-bold">
                                {getInitials(firstName, lastName)}
                              </span>
                            </div>
                            <div>
                              <p className="text-slate-900 font-medium text-sm">{fullName}</p>
                              <p className="text-slate-400 text-xs">
                                {ts.crew_trade ?? ''}
                                {ts.crew_rank ? ` · ${ts.crew_rank}` : ''}
                                {ts.crew_number ? ` · ${ts.crew_number}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-slate-600 text-xs">{ts.crew_trade ?? '—'}</p>
                          {ts.crew_rank && <p className="text-slate-400 text-xs">{ts.crew_rank}</p>}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 text-sm text-right font-medium">
                          {net !== null ? `£${net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {invoiced
                            ? <CheckCircle2 size={16} className="text-green-500 mx-auto" />
                            : <AlertCircle size={16} className="text-orange-400 mx-auto" />}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        {canAct && (
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              {/* Verify — only if invoice_received */}
                              {ts.status === 'invoice_received' && (
                                <button
                                  onClick={() => handleVerify(ts.id)}
                                  disabled={verifying === ts.id}
                                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors font-medium"
                                >
                                  {verifying === ts.id
                                    ? <Loader2 size={12} className="animate-spin" />
                                    : <ShieldCheck size={12} />}
                                  Verify
                                </button>
                              )}
                              {/* Edit entries link */}
                              {(ts.status as string) !== 'finalised' && ts.status !== 'verified' && (
                                <Link
                                  href={`/timesheets/${ts.id}`}
                                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                                >
                                  <ExternalLink size={12} />
                                  Edit Entries
                                </Link>
                              )}
                              {/* Attach Invoice — only if sent or reviewed */}
                              {(ts.status === 'sent' || ts.status === 'reviewed') && (
                                <button
                                  onClick={() => setAttachModal({ id: ts.id, name: fullName })}
                                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                                >
                                  <Paperclip size={12} />
                                  Attach Invoice
                                </button>
                              )}
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

          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-slate-400 text-xs">
              {loading
                ? 'Loading…'
                : filteredSheets.length === sheets.length
                  ? `${sheets.length} timesheet${sheets.length !== 1 ? 's' : ''} this week`
                  : `${filteredSheets.length} of ${sheets.length} timesheet${sheets.length !== 1 ? 's' : ''} (filtered)`}
            </span>
          </div>
        </div>

      </main>
    </>
  );
}
