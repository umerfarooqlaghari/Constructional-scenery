import TopBar from '@/components/TopBar';
import { Save, Plus, Trash2, ChevronDown, Calculator } from 'lucide-react';

const percentometerRatios = [
  { type: 'Carpenters', pct: 42, color: 'bg-teal-500' },
  { type: 'Painters', pct: 18, color: 'bg-blue-500' },
  { type: 'Stagehands', pct: 9, color: 'bg-indigo-400' },
  { type: 'Timber', pct: 9, color: 'bg-amber-500' },
  { type: 'Riggers', pct: 6, color: 'bg-orange-500' },
  { type: 'Plasterwork', pct: 6, color: 'bg-pink-500' },
  { type: 'Misc', pct: 3, color: 'bg-slate-400' },
  { type: 'Sculptors', pct: 2, color: 'bg-purple-500' },
  { type: 'Metalwork', pct: 2, color: 'bg-cyan-500' },
  { type: 'Paint', pct: 2, color: 'bg-green-500' },
  { type: 'Glass', pct: 1, color: 'bg-rose-400' },
];

// Example: Carpenter cost = £52,960 → total = £52,960 / 0.42 = £126,095
const carpenterCost = 52960;
const total = Math.round(carpenterCost / 0.42);

const labourRows = [
  { trade: 'Carpenter HOD', crew: 1, weeks: 10, ot: 20, dailyRate: 448, weeklyRate: 2240 },
  { trade: 'Carpenter Chargehand', crew: 2, weeks: 10, ot: 15, dailyRate: 388, weeklyRate: 1940 },
  { trade: 'Carpenter', crew: 6, weeks: 8, ot: 10, dailyRate: 352, weeklyRate: 1760 },
  { trade: 'Stagehand HOD', crew: 1, weeks: 10, ot: 5, dailyRate: 392, weeklyRate: 1960 },
  { trade: 'Stagehand', crew: 4, weeks: 8, ot: 0, dailyRate: 310, weeklyRate: 1550 },
  { trade: 'Scenic Painter HOD', crew: 1, weeks: 6, ot: 10, dailyRate: 448, weeklyRate: 2240 },
];

const scenarios = [
  { name: 'Phantom Light — Base Case', labour: 148400, materials: 62800, total: 211200, date: '02 May 2026' },
  { name: 'Phantom Light — Optimistic', labour: 128000, materials: 55000, total: 183000, date: '02 May 2026' },
  { name: 'Phantom Light — Conservative', labour: 168000, materials: 74000, total: 242000, date: '03 May 2026' },
];

export default function ForecastingPage() {
  return (
    <>
      <TopBar title="Forecasting & Job Costing" subtitle="Labour and materials forecasting with scenario comparison" />
      <main className="flex-1 p-6 space-y-5">

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {/* Percentometer */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-slate-900 font-semibold text-sm">The Percentometer</h2>
              <p className="text-slate-400 text-xs mt-0.5">Rapid job cost estimator — enter one known figure to calculate all</p>
            </div>
            <div className="p-5">
              {/* Input */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 font-medium block mb-1">Known Cost Figure (Carpenters)</label>
                  <div className="flex items-center bg-slate-50 border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500">
                    <span className="px-3 text-slate-500 font-semibold text-sm bg-slate-100 border-r border-slate-300 py-2.5">£</span>
                    <input
                      type="number"
                      defaultValue="52960"
                      className="flex-1 px-3 py-2.5 text-slate-900 font-bold text-sm bg-transparent outline-none"
                    />
                  </div>
                </div>
                <div className="pt-5">
                  <button className="flex items-center gap-2 bg-teal-600 text-white text-sm rounded-lg px-4 py-2.5 hover:bg-teal-700 font-medium">
                    <Calculator size={15} /> Calculate
                  </button>
                </div>
              </div>

              {/* Results */}
              <div className="space-y-2.5">
                {percentometerRatios.map((r) => {
                  const value = Math.round((r.pct / 42) * carpenterCost);
                  return (
                    <div key={r.type} className="flex items-center gap-3">
                      <div className="w-28 text-slate-700 text-xs font-medium">{r.type}</div>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div className={`h-2 rounded-full ${r.color}`} style={{ width: `${r.pct}%` }} />
                        </div>
                        <span className="text-slate-500 text-xs w-8 text-right">{r.pct}%</span>
                      </div>
                      <div className="w-20 text-slate-900 text-xs font-semibold text-right">
                        £{value.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total */}
              <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                <span className="text-slate-700 font-semibold text-sm">Estimated Total Job Cost</span>
                <span className="text-teal-700 text-xl font-black">£{total.toLocaleString()}</span>
              </div>

              <div className="mt-3 flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-2 border border-teal-200 bg-teal-50 text-teal-700 text-sm rounded-lg px-4 py-2 hover:bg-teal-100 font-medium">
                  <Save size={14} /> Save as Scenario
                </button>
              </div>
            </div>
          </div>

          {/* Labour Cost Forecaster */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-slate-900 font-semibold text-sm">Labour Cost Forecaster</h2>
                <p className="text-slate-400 text-xs mt-0.5">Build crew cost model from BECTU rate card</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">Production:</span>
                <button className="flex items-center gap-1 text-slate-900 text-xs font-semibold">Phantom Light <ChevronDown size={12} /></button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-2.5 text-slate-500 font-semibold text-left">Crew Type</th>
                    <th className="px-4 py-2.5 text-slate-500 font-semibold text-center">No.</th>
                    <th className="px-4 py-2.5 text-slate-500 font-semibold text-center">Weeks</th>
                    <th className="px-4 py-2.5 text-slate-500 font-semibold text-center">OT Hrs</th>
                    <th className="px-4 py-2.5 text-slate-500 font-semibold text-right">Wkly Rate</th>
                    <th className="px-4 py-2.5 text-slate-500 font-semibold text-right">Subtotal</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {labourRows.map((r) => {
                    const otRate = (r.dailyRate / 7.5) * 1.5;
                    const subtotal = Math.round(r.crew * (r.weeks * r.weeklyRate + r.ot * otRate));
                    return (
                      <tr key={r.trade} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-slate-800 font-medium">{r.trade}</td>
                        <td className="px-4 py-2.5 text-center">
                          <input type="number" defaultValue={r.crew} className="w-10 text-center border border-slate-200 rounded px-1 py-0.5 text-slate-700 text-xs" />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <input type="number" defaultValue={r.weeks} className="w-10 text-center border border-slate-200 rounded px-1 py-0.5 text-slate-700 text-xs" />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <input type="number" defaultValue={r.ot} className="w-10 text-center border border-slate-200 rounded px-1 py-0.5 text-slate-700 text-xs" />
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 text-right">£{r.weeklyRate.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-slate-900 font-semibold text-right">£{subtotal.toLocaleString()}</td>
                        <td className="px-4 py-2.5">
                          <button className="text-slate-300 hover:text-red-400 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="px-4 py-2.5 font-bold text-slate-700" colSpan={5}>Total Labour Forecast</td>
                    <td className="px-4 py-2.5 font-black text-teal-700 text-sm text-right">
                      £{labourRows.reduce((s, r) => {
                        const otRate = (r.dailyRate / 7.5) * 1.5;
                        return s + Math.round(r.crew * (r.weeks * r.weeklyRate + r.ot * otRate));
                      }, 0).toLocaleString()}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-slate-100">
              <button className="flex items-center gap-2 text-teal-600 text-xs font-medium hover:underline">
                <Plus size={13} /> Add Crew Type
              </button>
            </div>
          </div>
        </div>

        {/* Saved Scenarios */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-slate-900 font-semibold text-sm">Saved Scenarios</h2>
              <p className="text-slate-400 text-xs mt-0.5">Compare named forecasts for the same job</p>
            </div>
            <button className="flex items-center gap-2 bg-teal-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-teal-700 font-medium">
              <Save size={14} /> Save Current Scenario
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-2.5 text-xs font-semibold text-slate-500 text-left">Scenario Name</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-right">Labour Forecast</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-right">Materials Forecast</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-right">Total</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Saved</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scenarios.map((s, i) => (
                  <tr key={s.name} className={`hover:bg-slate-50/50 transition-colors ${i === 0 ? 'border-l-2 border-l-teal-500' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {i === 0 && <span className="text-[10px] px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded font-medium">Active</span>}
                        <span className="text-slate-800 font-medium">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 text-right">£{s.labour.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-slate-600 text-right">£{s.materials.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-slate-900 font-bold text-right">£{s.total.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-slate-400 text-xs">{s.date}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-2">
                        <button className="text-xs text-teal-600 hover:underline font-medium">Load</button>
                        <button className="text-xs text-red-400 hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </>
  );
}
