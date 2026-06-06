'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { timesheetsApi, crewApi, type Timesheet } from '@/lib/api';
import { ChevronLeft, Save, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_OPTIONS = [
  { label: '—', value: '' },
  { label: '£5', value: '5' },
  { label: '£10', value: '10' },
];

const inputCls =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500';

const selectCls =
  'border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

type DayEntry = {
  date: string;
  day_of_week: string;
  full_day_worked: boolean;
  overtime_hours: string;
  set_number: string;
  site: string;
  travel: string;
  meal_breakfast: boolean;
  meal_lunch: boolean;
  meal_supper: boolean;
  meal_allowance_breakfast: string;
  meal_allowance_lunch: string;
  meal_allowance_supper: string;
};

function getWeekDates(weekEndingDate: string): string[] {
  const end = new Date(weekEndingDate);
  return DAYS_OF_WEEK.map((_, i) => {
    const d = new Date(end);
    d.setDate(end.getDate() - 6 + i);
    return d.toISOString().split('T')[0];
  });
}

export default function TimesheetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [ts, setTs] = useState<Timesheet & Record<string, unknown> | null>(null);
  const [trades, setTrades] = useState<{ bectu: Record<string, string[]>; non_bectu: string[] } | null>(null);
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [rankOverride, setRankOverride] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [tsData, tradesData] = await Promise.all([
        timesheetsApi.getById(id),
        crewApi.getTrades(),
      ]);
      setTs(tsData as Timesheet & Record<string, unknown>);
      setTrades(tradesData);
      setRankOverride((tsData as Record<string, unknown>).rank_override as string ?? '');

      // Build entries from week dates
      const dates = getWeekDates((tsData as Timesheet).week_ending_date);
      const existing = ((tsData as Record<string, unknown>).timesheet_entries as DayEntry[]) ?? [];
      const existingMap = Object.fromEntries(existing.map((e) => [e.date, e]));

      setEntries(dates.map((date, i) => {
        const ex = existingMap[date];
        return {
          date,
          day_of_week:              DAYS_OF_WEEK[i],
          full_day_worked:          ex?.full_day_worked ?? false,
          overtime_hours:           String(ex?.overtime_hours ?? '0'),
          set_number:               ex?.set_number ?? '',
          site:                     ex?.site ?? '',
          travel:                   String(ex?.travel ?? '0'),
          meal_breakfast:           ex?.meal_breakfast ?? false,
          meal_lunch:               ex?.meal_lunch ?? false,
          meal_supper:              ex?.meal_supper ?? false,
          meal_allowance_breakfast: String(ex?.meal_allowance_breakfast ?? ''),
          meal_allowance_lunch:     String(ex?.meal_allowance_lunch ?? ''),
          meal_allowance_supper:    String(ex?.meal_allowance_supper ?? ''),
        };
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load timesheet');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const updateEntry = (idx: number, field: keyof DayEntry, value: string | boolean) => {
    setEntries(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      // Sync boolean flag with amount field
      if (field === 'meal_allowance_breakfast') next[idx].meal_breakfast = value !== '';
      if (field === 'meal_allowance_lunch')     next[idx].meal_lunch = value !== '';
      if (field === 'meal_allowance_supper')    next[idx].meal_supper = value !== '';
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      const payload: Record<string, unknown> = {
        entries: entries.filter(e => e.full_day_worked || parseFloat(e.overtime_hours || '0') > 0 || parseFloat(e.travel || '0') > 0 || e.meal_allowance_breakfast || e.meal_allowance_lunch || e.meal_allowance_supper).map(e => ({
          date:                     e.date,
          day_of_week:              e.day_of_week,
          full_day_worked:          e.full_day_worked,
          overtime_hours:           parseFloat(e.overtime_hours || '0'),
          set_number:               e.set_number || null,
          site:                     e.site || null,
          travel:                   parseFloat(e.travel || '0'),
          meal_breakfast:           e.meal_breakfast,
          meal_lunch:               e.meal_lunch,
          meal_supper:              e.meal_supper,
          meal_allowance_breakfast: e.meal_allowance_breakfast ? parseFloat(e.meal_allowance_breakfast) : null,
          meal_allowance_lunch:     e.meal_allowance_lunch ? parseFloat(e.meal_allowance_lunch) : null,
          meal_allowance_supper:    e.meal_allowance_supper ? parseFloat(e.meal_allowance_supper) : null,
        })),
      };
      if (rankOverride && ts && rankOverride !== (ts as Record<string, unknown>).crew_rank) {
        payload.rank_override = rankOverride;
      }

      await fetch(`/api/timesheets/${id}/entries`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('cs_token')}`,
        },
        body: JSON.stringify(payload),
      }).then(async r => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as { error?: string }).error ?? 'Save failed'); }
        return r.json();
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const currentTrade = ts ? String((ts as Record<string, unknown>).crew_trade ?? '') : '';
  const availableRanks: string[] = trades
    ? (trades.bectu[currentTrade] ?? []).concat(trades.non_bectu)
    : [];
  const defaultRank = ts ? String((ts as Record<string, unknown>).crew_rank ?? '') : '';

  const isLocked = (ts?.status as string) === 'finalised' || ts?.status === 'verified';

  if (loading) {
    return (
      <>
        <TopBar title="Timesheet" subtitle="Loading…" />
        <main className="flex-1 p-4 md:p-6 space-y-4">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </main>
      </>
    );
  }

  if (!ts) {
    return (
      <>
        <TopBar title="Timesheet" subtitle="Not found" />
        <main className="flex-1 p-4 md:p-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">{error || 'Timesheet not found'}</div>
        </main>
      </>
    );
  }

  const firstName = String((ts as Record<string, unknown>).first_name ?? '');
  const lastName  = String((ts as Record<string, unknown>).last_name ?? '');
  const crewName  = `${firstName} ${lastName}`.trim() || 'Unknown';
  const prodName  = String((ts as Record<string, unknown>).prod_name ?? '');

  return (
    <>
      <TopBar
        title={`Timesheet — ${crewName}`}
        subtitle={`${prodName} · w/e ${fmtDate(ts.week_ending_date)}`}
      />
      <main className="flex-1 p-4 md:p-6 space-y-4">

        {/* Back + Save bar */}
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm font-medium">
            <ChevronLeft size={16} /> Back to Timesheets
          </button>
          {!isLocked && (
            <div className="flex items-center gap-3">
              {saved && <span className="flex items-center gap-1.5 text-green-600 text-sm"><CheckCircle2 size={15} /> Saved</span>}
              {error && <span className="text-red-600 text-sm flex items-center gap-1.5"><AlertCircle size={14} />{error}</span>}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 shadow-sm"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Entries
              </button>
            </div>
          )}
        </div>

        {isLocked && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-sm flex items-center gap-2">
            <AlertCircle size={15} /> This timesheet is locked ({ts.status}) and cannot be edited.
          </div>
        )}

        {/* Rank override (Gap 3) */}
        {!isLocked && availableRanks.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-slate-900 font-semibold text-sm mb-3">Rank Override This Week</h2>
            <p className="text-slate-500 text-xs mb-3">
              Default rank: <span className="font-medium text-slate-700">{defaultRank}</span>.
              Select a different rank if this crew member was promoted or acted up this week.
              This only affects this week&apos;s rate — the Crew Database record is not changed.
            </p>
            <div className="flex items-center gap-3">
              <select
                value={rankOverride || defaultRank}
                onChange={e => setRankOverride(e.target.value === defaultRank ? '' : e.target.value)}
                className={selectCls + ' w-64'}
              >
                <option value={defaultRank}>{defaultRank} (default)</option>
                {availableRanks.filter(r => r !== defaultRank).map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {rankOverride && rankOverride !== defaultRank && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Override active</span>
              )}
            </div>
          </div>
        )}

        {/* Daily entries editor */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-slate-900 font-semibold text-sm">Daily Entries</h2>
            <p className="text-slate-400 text-xs mt-0.5">Tick days worked, set OT hours, site, and meal allowances</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left w-28">Day</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center w-20">Worked</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left w-24">OT Hrs</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Set No.</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Site</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left w-20">Travel £</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left w-24">Breakfast</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left w-24">Lunch</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left w-24">Supper</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((e, i) => {
                  const isWeekend = e.day_of_week === 'Saturday' || e.day_of_week === 'Sunday';
                  return (
                    <tr key={e.date} className={`${isWeekend ? 'bg-slate-50/50' : ''} ${isLocked ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="text-slate-900 font-medium text-sm">{e.day_of_week}</p>
                        <p className="text-slate-400 text-xs">{new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={e.full_day_worked}
                          onChange={ev => !isLocked && updateEntry(i, 'full_day_worked', ev.target.checked)}
                          disabled={isLocked}
                          className="w-4 h-4 accent-blue-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number" min="0" step="0.5"
                          value={e.overtime_hours}
                          onChange={ev => !isLocked && updateEntry(i, 'overtime_hours', ev.target.value)}
                          disabled={isLocked}
                          className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text" placeholder="—"
                          value={e.set_number}
                          onChange={ev => !isLocked && updateEntry(i, 'set_number', ev.target.value)}
                          disabled={isLocked}
                          className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text" placeholder="—"
                          value={e.site}
                          onChange={ev => !isLocked && updateEntry(i, 'site', ev.target.value)}
                          disabled={isLocked}
                          className="w-32 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number" min="0" step="0.01"
                          value={e.travel}
                          onChange={ev => !isLocked && updateEntry(i, 'travel', ev.target.value)}
                          disabled={isLocked}
                          className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      {/* Meal allowance dropdowns (Gap 6) */}
                      {(['meal_allowance_breakfast', 'meal_allowance_lunch', 'meal_allowance_supper'] as const).map(field => (
                        <td key={field} className="px-4 py-3">
                          <select
                            value={e[field]}
                            onChange={ev => !isLocked && updateEntry(i, field, ev.target.value)}
                            disabled={isLocked}
                            className={selectCls + ' w-20'}
                          >
                            {MEAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Save reminder at bottom */}
        {!isLocked && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 shadow-sm"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Entries
            </button>
          </div>
        )}
      </main>
    </>
  );
}
