'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { crewRatesApi, CrewRate } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  Pencil, Check, X, Upload, Loader2, AlertCircle, RefreshCw,
} from 'lucide-react';

const fmt = (v: string | null) =>
  v == null ? '—' : `£${parseFloat(v).toFixed(2)}`;

// Group rates by trade
function groupByTrade(rates: CrewRate[]) {
  const groups: Record<string, CrewRate[]> = {};
  for (const r of rates) {
    if (!groups[r.trade]) groups[r.trade] = [];
    groups[r.trade].push(r);
  }
  return groups;
}

// ─── Import CSV Modal ─────────────────────────────────────────────────────────
interface ImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

function ImportModal({ onClose, onImported }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [rateYear, setRateYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ message: string; inserted: number; expired: number } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError('Please select a CSV file.'); return; }
    if (!effectiveFrom) { setError('Effective from date is required.'); return; }
    if (!rateYear) { setError('Rate year is required (e.g. 2027/28).'); return; }
    setLoading(true); setError('');
    const fd = new FormData();
    fd.append('csv', file);
    fd.append('effective_from', effectiveFrom);
    fd.append('rate_year', rateYear);
    try {
      const res = await crewRatesApi.importCSV(fd);
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-slate-900 font-semibold text-sm">Import New Year BECTU Rates</h2>
            <p className="text-slate-400 text-xs mt-0.5">CSV format: trade, rank, daily_rate, overtime_rate</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>

        {result ? (
          <div className="px-5 py-6 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-green-800 font-semibold text-sm">{result.message}</p>
              <p className="text-green-700 text-xs mt-1">{result.inserted} rates inserted · {result.expired} previous rates expired</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { onImported(); onClose(); }} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="px-5 py-4 space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle size={13} /> {error}
              </div>
            )}

            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-700">Expected CSV columns:</p>
              <p className="font-mono">trade, rank, daily_rate, overtime_rate</p>
              <p className="text-slate-500 mt-1">Example row: <span className="font-mono">Carpenters,HOD,430.00,64.50</span></p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Effective From *</label>
                <input type="date" className={inp} value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Rate Year * <span className="text-slate-400">(e.g. 2027/28)</span></label>
                <input className={inp} placeholder="2027/28" value={rateYear} onChange={e => setRateYear(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">CSV File *</label>
              <label className="flex items-center gap-3 border-2 border-dashed border-slate-200 rounded-lg px-4 py-4 cursor-pointer hover:border-blue-400 transition-colors">
                <Upload size={18} className="text-slate-400 flex-shrink-0" />
                <div>
                  <p className="text-slate-600 text-sm font-medium">{file ? file.name : 'Click to select CSV'}</p>
                  <p className="text-slate-400 text-xs">trade, rank, daily_rate, overtime_rate</p>
                </div>
                <input type="file" className="hidden" accept=".csv,text/csv" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
              <button type="submit" disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                Import
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RateCardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [rates, setRates] = useState<CrewRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showImport, setShowImport] = useState(false);

  // Inline edit state for non-BECTU rows
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ daily_rate: '', overtime_rate: '' });
  const [saving, setSaving] = useState(false);

  // Guard: MD only
  useEffect(() => {
    if (user && user.role !== 'managing_director') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await crewRatesApi.list({ current: 'true' });
      setRates(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load rates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (rate: CrewRate) => {
    setEditingId(rate.id);
    setEditValues({
      daily_rate:    rate.daily_rate    ? parseFloat(rate.daily_rate).toFixed(2)    : '',
      overtime_rate: rate.overtime_rate ? parseFloat(rate.overtime_rate).toFixed(2) : '',
    });
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      const updated = await crewRatesApi.update(id, {
        daily_rate:    editValues.daily_rate    || null,
        overtime_rate: editValues.overtime_rate || null,
      });
      setRates(prev => prev.map(r => r.id === id ? updated : r));
      setEditingId(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const grouped = groupByTrade(rates);
  const bectuTrades    = Object.entries(grouped).filter(([t]) => t !== 'Non-BECTU');
  const nonBectuRates  = grouped['Non-BECTU'] ?? [];

  if (user?.role !== 'managing_director') return null;

  return (
    <>
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={load}
        />
      )}

      <TopBar title="Rate Card" subtitle="2026/27 Pact/BECTU Construction Crew Agreement" />
      <main className="flex-1 p-4 md:p-6 space-y-5">

        {/* Header actions */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-sm">
              Current rates — <span className="font-medium text-slate-700">effective from 7 Apr 2026</span>
            </p>
            <p className="text-slate-400 text-xs mt-0.5">BECTU rates are read-only. Non-BECTU rates are editable below.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Upload size={13} />
              Import New Year Rates
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-4 text-red-600 text-sm">{error}</div>
        )}

        {/* Non-BECTU Rates — editable */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-slate-900 font-semibold text-sm">Non-BECTU Roles</h2>
            <p className="text-slate-400 text-xs mt-0.5">Directly agreed with Warren. Edit daily and OT rates below.</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-5 py-2.5 text-xs font-semibold text-slate-500">Role</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-right">Daily Rate</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-right">OT Rate / hr</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 4 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                ))}</tr>
              )) : nonBectuRates.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-400 text-xs">No non-BECTU rates found.</td></tr>
              ) : nonBectuRates.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-800">{r.rank}</td>
                  <td className="px-4 py-3 text-right">
                    {editingId === r.id ? (
                      <input
                        type="number" step="0.01" min="0"
                        value={editValues.daily_rate}
                        onChange={e => setEditValues(v => ({ ...v, daily_rate: e.target.value }))}
                        className="w-24 border border-blue-300 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    ) : (
                      <span className={r.daily_rate ? 'text-slate-800 font-medium' : 'text-slate-300 italic'}>
                        {fmt(r.daily_rate)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === r.id ? (
                      <input
                        type="number" step="0.01" min="0"
                        value={editValues.overtime_rate}
                        onChange={e => setEditValues(v => ({ ...v, overtime_rate: e.target.value }))}
                        className="w-24 border border-blue-300 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    ) : (
                      <span className={r.overtime_rate ? 'text-slate-600' : 'text-slate-300 italic'}>
                        {fmt(r.overtime_rate)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === r.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => saveEdit(r.id)}
                          disabled={saving}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(r)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Pencil size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* BECTU Rates — read-only, grouped by trade */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-slate-900 font-semibold text-sm">BECTU/Pact Rates — 2026/27</h2>
              <p className="text-slate-400 text-xs mt-0.5">Read-only. Use &quot;Import New Year Rates&quot; to add a new card.</p>
            </div>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
              {rates.filter(r => r.rate_type === 'bectu').length} rates active
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-5 py-2.5 text-xs font-semibold text-slate-500">Trade</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Rank</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-right">Daily (£)</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-right">OT / hr (£)</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-right">Weekly (£)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-t border-slate-100">{Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  ))}</tr>
                )) : bectuTrades.map(([trade, tradeRates]) => (
                  tradeRates.map((r, idx) => (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-5 py-2.5">
                        {idx === 0
                          ? <span className="text-slate-800 font-semibold text-xs">{trade}</span>
                          : <span className="text-slate-300 text-xs">↳</span>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 text-xs">{r.rank}</td>
                      <td className="px-4 py-2.5 text-slate-800 text-right font-medium">{fmt(r.daily_rate)}</td>
                      <td className="px-4 py-2.5 text-slate-600 text-right">{fmt(r.overtime_rate)}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-right text-xs">{r.weekly_rate ? fmt(r.weekly_rate) : '—'}</td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
