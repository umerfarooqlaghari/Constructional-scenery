'use client';

import { useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import { dashboardApi, type DashboardData } from '@/lib/api';
import {
  TrendingUp, TrendingDown, Users, ShoppingCart, AlertCircle,
  CheckCircle2, Clock, Clapperboard, ArrowUpRight, TrendingDown as VarDown,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const statusLabel: Record<string, string> = {
  pre_production: 'Pre-Production',
  active_build:   'Active Build',
  strike:         'Strike',
  complete:       'Complete',
  archived:       'Archived',
};
const phaseColor: Record<string, string> = {
  pre_production: 'bg-slate-100 text-slate-600',
  active_build:   'bg-blue-100 text-blue-700',
  strike:         'bg-amber-100 text-amber-700',
  complete:       'bg-green-100 text-green-700',
  archived:       'bg-slate-100 text-slate-400',
};
const ragClass: Record<string, string>  = { green: 'bg-green-500', amber: 'bg-amber-400', red: 'bg-red-500', unknown: 'bg-slate-300' };
const ragLabel: Record<string, string>  = { green: 'On Track', amber: 'Monitor', red: 'At Risk', unknown: 'No Budget' };
const ragBadge: Record<string, string>  = { green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', unknown: 'bg-slate-100 text-slate-500' };
const varBadge: Record<string, string>  = {
  over_forecast:   'bg-red-100 text-red-700',
  under_forecast:  'bg-green-100 text-green-700',
  on_track:        'bg-slate-100 text-slate-600',
};
const varLabel: Record<string, string>  = {
  over_forecast:   'Over Forecast',
  under_forecast:  'Under Forecast',
  on_track:        'On Track',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4 shadow-sm">
      <Skeleton className="w-10 h-10 rounded-lg" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MDDashboard() {
  const [data, setData]     = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  useEffect(() => {
    dashboardApi.get()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return (
    <>
      <TopBar title="Managing Director Dashboard" subtitle={today} />
      <main className="flex-1 p-4 md:p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">
          Failed to load dashboard: {error}
        </div>
      </main>
    </>
  );

  // Derived values
  const activeCount   = data?.active_productions.length ?? 0;
  const crewTotal     = data?.crew_headcount.total ?? 0;
  const weekPOSpend   = data?.po_spend.week_total ?? 0;
  const pendingTotal  = data?.pending_approvals.total ?? 0;
  const pendingDetail = data
    ? `${data.pending_approvals.purchase_orders} POs · ${data.pending_approvals.timesheets} timesheets`
    : '';

  const statCards = [
    { label: 'Active Productions', value: String(activeCount), change: 'Active now',        up: null,  icon: Clapperboard, color: 'bg-teal-50 text-teal-600' },
    { label: 'Total Crew On Site', value: String(crewTotal),   change: 'Across all builds', up: null,  icon: Users,        color: 'bg-blue-50 text-blue-600' },
    { label: 'Weekly PO Spend',    value: fmt(weekPOSpend),    change: fmt(data?.po_spend.today_total ?? 0) + ' today', up: false, icon: ShoppingCart, color: 'bg-orange-50 text-orange-600' },
    { label: 'Pending Approvals',  value: String(pendingTotal), change: pendingDetail,      up: null,  icon: AlertCircle,  color: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <>
      <TopBar title="Managing Director Dashboard" subtitle={today} />
      <main className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6">

        {/* ── Stat Cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {loading
            ? Array(4).fill(0).map((_, i) => <CardSkeleton key={i} />)
            : statCards.map(({ label, value, change, up, icon: Icon, color }) => (
              <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4 shadow-sm">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon size={20} />
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-medium">{label}</p>
                  <p className="text-slate-900 text-2xl font-bold mt-0.5">{value}</p>
                  <p className={`text-xs mt-1 flex items-center gap-1 ${up === true ? 'text-green-600' : up === false ? 'text-red-500' : 'text-slate-400'}`}>
                    {up === true && <TrendingUp size={12} />}
                    {up === false && <TrendingDown size={12} />}
                    {change}
                  </p>
                </div>
              </div>
            ))}
        </div>

        {/* ── Cost RAG + Labour ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Cost Report RAG */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-slate-900 font-semibold text-sm">Cost Report — Active Productions</h2>
                <p className="text-slate-400 text-xs mt-0.5">Budget vs actual spend with RAG status</p>
              </div>
              <a href="/cost-report" className="text-teal-600 text-xs font-medium flex items-center gap-1 hover:underline">
                View all <ArrowUpRight size={12} />
              </a>
            </div>
            <div className="divide-y divide-slate-100">
              {loading
                ? Array(3).fill(0).map((_, i) => (
                  <div key={i} className="px-5 py-4 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))
                : data?.active_productions.length === 0
                  ? <p className="px-5 py-8 text-slate-400 text-sm text-center">No active productions</p>
                  : data?.active_productions.map((p) => {
                    const pctUsed = p.percent_remaining
                      ? Math.round(100 - parseFloat(p.percent_remaining))
                      : p.total_budget && p.total_budget > 0
                        ? Math.round((p.total_costs_to_date / p.total_budget) * 100)
                        : 0;
                    return (
                      <div key={p.id} className="px-5 py-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-slate-900 text-sm font-semibold">{p.name}</span>
                            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${phaseColor[p.status] ?? ''}`}>
                              {statusLabel[p.status] ?? p.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-500 text-xs">
                              {fmt(p.total_costs_to_date)}
                              {p.total_budget ? ` / ${fmt(p.total_budget)}` : ''}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ragBadge[p.rag_status]}`}>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${ragClass[p.rag_status]}`} />
                              {ragLabel[p.rag_status]}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div className={`h-2 rounded-full ${ragClass[p.rag_status]}`} style={{ width: `${Math.min(pctUsed, 100)}%` }} />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-slate-400 text-[10px]">{statusLabel[p.status]}</span>
                          <span className="text-slate-400 text-[10px]">{pctUsed}% of budget used</span>
                        </div>
                      </div>
                    );
                  })
              }
            </div>
          </div>

          {/* Current Week Labour */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-slate-900 font-semibold text-sm">Current Week Labour</h2>
              <p className="text-slate-400 text-xs mt-0.5">
                {data ? `Week ending ${fmtDate(data.current_week.end)}` : 'Loading…'}
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {loading
                ? Array(3).fill(0).map((_, i) => (
                  <div key={i} className="px-5 py-3.5 flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))
                : data?.current_week_labour.by_production.length === 0
                  ? <p className="px-5 py-8 text-slate-400 text-sm text-center">No timesheets this week</p>
                  : data?.current_week_labour.by_production.map((l) => {
                    const crew = data.crew_headcount.by_production.find(c => c.production === l.production);
                    return (
                      <div key={l.production} className="px-5 py-3.5 flex items-center justify-between">
                        <div>
                          <p className="text-slate-800 text-sm font-medium">{l.production}</p>
                          <p className="text-slate-400 text-xs">{crew?.headcount ?? '—'} crew members</p>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-900 text-sm font-semibold">{fmt(l.total)}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${l.pending > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                            {l.pending > 0
                              ? <><Clock size={9} className="inline mr-1" />Pending</>
                              : <><CheckCircle2 size={9} className="inline mr-1" />Approved</>}
                          </span>
                        </div>
                      </div>
                    );
                  })
              }
              {!loading && data && (
                <div className="px-5 py-3 bg-slate-50 flex justify-between items-center">
                  <span className="text-slate-600 text-xs font-medium">Total This Week</span>
                  <span className="text-slate-900 text-sm font-bold">{fmt(data.current_week_labour.total)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Pipeline + PO Spend ────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Production Pipeline */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-slate-900 font-semibold text-sm">Production Pipeline</h2>
                <p className="text-slate-400 text-xs mt-0.5">All active & upcoming productions</p>
              </div>
              <a href="/productions" className="text-teal-600 text-xs font-medium flex items-center gap-1 hover:underline">
                View all <ArrowUpRight size={12} />
              </a>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-5 py-2.5 text-xs font-semibold text-slate-500">Production</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-slate-500">Phase</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-slate-500">End Date</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-right">Days Left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading
                  ? Array(3).fill(0).map((_, i) => (
                    <tr key={i}><td colSpan={4} className="px-5 py-3"><Skeleton className="h-4 w-full" /></td></tr>
                  ))
                  : data?.production_pipeline.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 text-slate-900 font-medium text-sm">{p.name}</td>
                      <td className="px-3 py-3.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${phaseColor[p.current_phase] ?? 'bg-slate-100 text-slate-600'}`}>
                          {statusLabel[p.current_phase] ?? p.current_phase}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-slate-500 text-xs">{fmtDate(p.end_date)}</td>
                      <td className="px-3 py-3.5 text-right">
                        {p.days_remaining === null ? (
                          <span className="text-slate-400 text-xs">—</span>
                        ) : p.days_remaining <= 0 ? (
                          <span className="text-slate-400 text-xs">Done</span>
                        ) : (
                          <span className={`text-xs font-semibold ${p.days_remaining <= 14 ? 'text-red-600' : p.days_remaining <= 30 ? 'text-amber-600' : 'text-green-600'}`}>
                            {p.days_remaining}d
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>

          {/* PO Spend */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-slate-900 font-semibold text-sm">Purchase Order Spend</h2>
                <p className="text-slate-400 text-xs mt-0.5">Approved PO spend by production</p>
              </div>
              <a href="/purchase-orders" className="text-teal-600 text-xs font-medium flex items-center gap-1 hover:underline">
                View all <ArrowUpRight size={12} />
              </a>
            </div>
            <div className="p-5 space-y-4">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-teal-50 rounded-lg p-4">
                      <p className="text-teal-600 text-xs font-medium">Today</p>
                      <p className="text-teal-900 text-xl font-bold mt-1">{fmt(data?.po_spend.today_total ?? 0)}</p>
                      <p className="text-teal-500 text-[10px] mt-0.5">approved POs</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-slate-500 text-xs font-medium">This Week</p>
                      <p className="text-slate-900 text-xl font-bold mt-1">{fmt(data?.po_spend.week_total ?? 0)}</p>
                      <p className="text-slate-400 text-[10px] mt-0.5">approved POs</p>
                    </div>
                  </div>
                  {data?.po_spend.by_production.length === 0 && (
                    <p className="text-slate-400 text-sm text-center py-2">No approved POs this week</p>
                  )}
                  <div className="space-y-2.5">
                    {data?.po_spend.by_production.map((item) => {
                      const pct = data.po_spend.week_total > 0
                        ? Math.round((item.total / data.po_spend.week_total) * 100)
                        : 0;
                      return (
                        <div key={item.production}>
                          <div className="flex justify-between text-xs text-slate-600 mb-1">
                            <span>{item.production}</span>
                            <span className="font-medium">{fmt(item.total)}</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div className="h-1.5 bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Forecasting Variance ───────────────────────────────────── */}
        {(loading || (data?.forecasting_variance.length ?? 0) > 0) && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-slate-900 font-semibold text-sm">Forecasting Variance</h2>
                <p className="text-slate-400 text-xs mt-0.5">Actual spend vs forecast per production</p>
              </div>
              <a href="/forecasting" className="text-teal-600 text-xs font-medium flex items-center gap-1 hover:underline">
                View forecasts <ArrowUpRight size={12} />
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-5 py-2.5 text-xs font-semibold text-slate-500">Production</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Forecast</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Actual</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Variance</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading
                    ? Array(3).fill(0).map((_, i) => (
                      <tr key={i}><td colSpan={5} className="px-5 py-3"><Skeleton className="h-4 w-full" /></td></tr>
                    ))
                    : data?.forecasting_variance.map((f, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-slate-900 text-sm font-medium">{f.production}</p>
                          <p className="text-slate-400 text-xs">{f.forecast_name}</p>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 text-sm">{fmt(f.forecast_total)}</td>
                        <td className="px-4 py-3.5 text-slate-600 text-sm">{fmt(f.actual_cost)}</td>
                        <td className="px-4 py-3.5">
                          <span className={`text-sm font-semibold flex items-center gap-1 ${f.variance_gbp > 0 ? 'text-red-600' : f.variance_gbp < 0 ? 'text-green-600' : 'text-slate-500'}`}>
                            {f.variance_gbp > 0 && <VarDown size={13} />}
                            {f.variance_gbp > 0 ? '+' : ''}{fmt(f.variance_gbp)}
                            <span className="text-xs font-normal">({f.variance_percentage}%)</span>
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${varBadge[f.status]}`}>
                            {varLabel[f.status]}
                          </span>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Cash Flow placeholder ──────────────────────────────────── */}
        {!loading && data && (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl px-5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={16} className="text-slate-500" />
            </div>
            <div>
              <p className="text-slate-600 text-sm font-medium">Cash Flow</p>
              <p className="text-slate-400 text-xs">{data.cash_flow.note}</p>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
