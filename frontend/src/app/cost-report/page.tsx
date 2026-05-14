import TopBar from '@/components/TopBar';
import { Download, ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const supplierCosts = [
  { date: '12 May 2026', supplier: 'Treeline Timber Co.', description: 'Structural timber — set build phase 2', requestedBy: 'J. Morley', po: 'PO-2026-0142', setCode: 'S003', netEx: 4200, vat: 840, total: 5040, method: 'Supplier Account' },
  { date: '11 May 2026', supplier: 'Scenic Solutions Ltd', description: 'Scenic paint & finishes — Ep 6 sets', requestedBy: 'C. Dixon', po: 'PO-2026-0141', setCode: 'S019', netEx: 1850, vat: 370, total: 2220, method: 'Pleo' },
  { date: '10 May 2026', supplier: 'ProFab Metalworks', description: 'Steel fabrication — dungeon gates', requestedBy: 'J. Morley', po: 'PO-2026-0140', setCode: 'S002', netEx: 3100, vat: 620, total: 3720, method: 'Arbuthnot' },
  { date: '07 May 2026', supplier: 'Treeline Timber Co.', description: 'Hardwood flooring — tavern interior', requestedBy: 'J. Morley', po: 'PO-2026-0137', setCode: 'S004', netEx: 1960, vat: 392, total: 2352, method: 'Supplier Account' },
];

const labourWeeks = [
  { week: 'W/E 04 May 2026', crew: 20, pct: 4.2, amount: 13840, trade: 'Mixed', sets: 'S001–S004' },
  { week: 'W/E 11 May 2026', crew: 22, pct: 4.6, amount: 14280, trade: 'Mixed', sets: 'S002–S005' },
];

export default function CostReportPage() {
  const totalSupplier = supplierCosts.reduce((s, r) => s + r.total, 0);
  const totalLabour = labourWeeks.reduce((s, r) => s + r.amount, 0);
  const totalCosts = totalSupplier + totalLabour;
  const budget = 480000;
  const profit = budget - totalCosts;
  const profitPct = ((profit / budget) * 100).toFixed(1);
  const spentPct = ((totalCosts / budget) * 100).toFixed(1);

  return (
    <>
      <TopBar title="Cost Report" subtitle="Live financial reporting across all active productions" />
      <main className="flex-1 p-6 space-y-5">

        {/* Production + Type Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-4 py-2.5 shadow-sm">
            <span className="text-slate-500 text-sm">Production:</span>
            <button className="flex items-center gap-1.5 text-slate-900 font-semibold text-sm">Meridian <ChevronDown size={14} /></button>
          </div>
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <button className="px-4 py-2.5 text-sm font-semibold bg-teal-600 text-white">Type 1 — On a Price</button>
            <button className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">Type 2 — Cost Plus</button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="flex items-center gap-2 text-slate-600 text-sm border border-slate-200 bg-white rounded-lg px-3 py-2 hover:bg-slate-50 shadow-sm">
              Run as at: <span className="font-semibold text-slate-900">13 May 2026</span> <ChevronDown size={14} />
            </button>
            <button className="flex items-center gap-2 text-slate-600 text-sm border border-slate-200 bg-white rounded-lg px-3 py-2 hover:bg-slate-50 shadow-sm">
              <Download size={14} /> Export PDF
            </button>
            <button className="flex items-center gap-2 text-slate-600 text-sm border border-slate-200 bg-white rounded-lg px-3 py-2 hover:bg-slate-50 shadow-sm">
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {[
            { label: 'Total Budget', value: `£${(budget / 1000).toFixed(0)}k`, sub: 'agreed fixed price', icon: null, color: 'text-slate-900' },
            { label: 'Total Costs to Date', value: `£${(totalCosts / 1000).toFixed(1)}k`, sub: `${spentPct}% of budget`, icon: null, color: 'text-slate-900' },
            { label: 'Current Profit', value: `£${(profit / 1000).toFixed(1)}k`, sub: `${profitPct}% margin`, icon: TrendingUp, color: 'text-green-600' },
            { label: 'Target Profit', value: '£48,000', sub: '10% target margin', icon: null, color: 'text-slate-900' },
            { label: 'Available Spend', value: `£${((budget - totalCosts) / 1000).toFixed(1)}k`, sub: 'remaining to target', icon: null, color: 'text-amber-600' },
            { label: 'Supplier Costs', value: `£${(totalSupplier / 1000).toFixed(1)}k`, sub: 'approved POs only', icon: null, color: 'text-slate-900' },
          ].map((m) => (
            <div key={m.label} className="bg-white rounded-xl border border-slate-200 px-4 py-4 shadow-sm">
              <p className="text-slate-500 text-xs font-medium leading-tight">{m.label}</p>
              <div className="flex items-center gap-1 mt-1">
                {m.icon && <m.icon size={14} className={m.color} />}
                <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
              </div>
              <p className="text-slate-400 text-[10px] mt-0.5">{m.sub}</p>
            </div>
          ))}
        </div>

        {/* Lead Summary — Amounts Invoiced to Production */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-slate-900 font-semibold text-sm">Amounts Invoiced to Production</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-2.5 text-xs font-semibold text-slate-500 text-left">Description</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">PO Number</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Date</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Invoice No.</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-right">Amount (£)</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { desc: 'Phase 1 — Pre-production build', po: 'PO-2026-0104', date: '28 Feb 2026', inv: 'CSL-0048', amount: 48000, notes: 'Approved' },
                  { desc: 'Phase 2 — Main sets deposit', po: 'PO-2026-0118', date: '01 Apr 2026', inv: 'CSL-0061', amount: 72000, notes: 'Approved' },
                  { desc: 'Phase 3 — Labour & materials', po: 'PO-2026-0131', date: '05 May 2026', inv: 'CSL-0074', amount: 90000, notes: 'Pending sign-off' },
                ].map((r) => (
                  <tr key={r.inv} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-slate-800 font-medium">{r.desc}</td>
                    <td className="px-4 py-3 text-teal-700 text-xs font-mono text-center">{r.po}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs text-center">{r.date}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs text-center">{r.inv}</td>
                    <td className="px-4 py-3 text-slate-900 font-semibold text-right">£{r.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{r.notes}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50">
                  <td className="px-5 py-2.5 text-slate-700 font-bold text-xs" colSpan={4}>Total Invoiced to Production</td>
                  <td className="px-4 py-2.5 text-slate-900 font-bold text-right">£210,000</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Supplier Costs */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-slate-900 font-semibold text-sm">Supplier Costs</h2>
              <span className="text-teal-600 text-xs font-semibold">Total: £{totalSupplier.toLocaleString()}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-2 text-slate-500 font-semibold text-left">Date</th>
                    <th className="px-4 py-2 text-slate-500 font-semibold text-left">Supplier</th>
                    <th className="px-4 py-2 text-slate-500 font-semibold text-left">Set</th>
                    <th className="px-4 py-2 text-slate-500 font-semibold text-right">Ex VAT</th>
                    <th className="px-4 py-2 text-slate-500 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supplierCosts.map((r) => (
                    <tr key={r.po} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-400">{r.date.slice(0, 6)}</td>
                      <td className="px-4 py-2.5 text-slate-700 font-medium">{r.supplier}</td>
                      <td className="px-4 py-2.5 text-slate-500 font-mono">{r.setCode}</td>
                      <td className="px-4 py-2.5 text-slate-600 text-right">£{r.netEx.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-slate-900 font-semibold text-right">£{r.total.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50">
                    <td className="px-4 py-2 font-bold text-slate-700" colSpan={4}>Subtotal</td>
                    <td className="px-4 py-2 font-bold text-slate-900 text-right">£{totalSupplier.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Labour Summary */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-slate-900 font-semibold text-sm">Labour Summary</h2>
              <span className="text-teal-600 text-xs font-semibold">Total: £{totalLabour.toLocaleString()}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-2 text-slate-500 font-semibold text-left">Week Ending</th>
                    <th className="px-4 py-2 text-slate-500 font-semibold text-center">Crew</th>
                    <th className="px-4 py-2 text-slate-500 font-semibold text-center">% Budget</th>
                    <th className="px-4 py-2 text-slate-500 font-semibold text-right">Amount</th>
                    <th className="px-4 py-2 text-slate-500 font-semibold">Running Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {labourWeeks.map((r, i) => {
                    const running = labourWeeks.slice(0, i + 1).reduce((s, w) => s + w.amount, 0);
                    return (
                      <tr key={r.week} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-slate-700 font-medium">{r.week}</td>
                        <td className="px-4 py-2.5 text-slate-500 text-center">{r.crew}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="text-amber-600 font-semibold">{r.pct}%</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-900 font-semibold text-right">£{r.amount.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-slate-500">£{running.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50">
                    <td className="px-4 py-2 font-bold text-slate-700" colSpan={3}>Subtotal</td>
                    <td className="px-4 py-2 font-bold text-slate-900 text-right">£{totalLabour.toLocaleString()}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Running total bar */}
            <div className="px-4 py-4 border-t border-slate-100">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Total Costs vs Budget</span>
                <span className="font-semibold text-slate-700">£{totalCosts.toLocaleString()} / £{budget.toLocaleString()}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="h-2 bg-teal-500 rounded-full" style={{ width: `${spentPct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>{spentPct}% spent</span>
                <span>{(100 - parseFloat(spentPct)).toFixed(1)}% remaining</span>
              </div>
            </div>
          </div>
        </div>

      </main>
    </>
  );
}
