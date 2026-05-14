import TopBar from '@/components/TopBar';
import {
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  AlertCircle,
  CheckCircle2,
  Clock,
  Clapperboard,
  ArrowUpRight,
} from 'lucide-react';

const stats = [
  {
    label: 'Active Productions',
    value: '3',
    change: '+1 this month',
    up: true,
    icon: Clapperboard,
    color: 'bg-teal-50 text-teal-600',
  },
  {
    label: 'Total Crew This Week',
    value: '47',
    change: '+5 vs last week',
    up: true,
    icon: Users,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    label: 'Weekly PO Spend',
    value: '£32,480',
    change: '-£4,200 vs last week',
    up: false,
    icon: ShoppingCart,
    color: 'bg-orange-50 text-orange-600',
  },
  {
    label: 'Pending Approvals',
    value: '6',
    change: '3 POs · 3 timesheets',
    up: null,
    icon: AlertCircle,
    color: 'bg-amber-50 text-amber-600',
  },
];

const productions = [
  {
    name: 'Meridian',
    type: 'Feature Film',
    budget: '£480,000',
    spent: '£312,450',
    pct: 65,
    rag: 'green',
    status: 'Active Build',
  },
  {
    name: 'The Bridge – S3',
    type: 'TV Series',
    budget: '£220,000',
    spent: '£198,800',
    pct: 90,
    rag: 'red',
    status: 'Active Build',
  },
  {
    name: 'Phantom Light',
    type: 'Feature Film',
    budget: '£155,000',
    spent: '£88,200',
    pct: 57,
    rag: 'amber',
    status: 'Pre-Production',
  },
];

const pipeline = [
  { name: 'Meridian', phase: 'Active Build', start: '14 Jan 2026', end: '28 Jun 2026', sets: 18 },
  { name: 'The Bridge – S3', phase: 'Active Build', start: '03 Mar 2026', end: '05 Jul 2026', sets: 24 },
  { name: 'Phantom Light', phase: 'Pre-Production', start: '01 Jun 2026', end: '15 Nov 2026', sets: 11 },
];

const labourCosts = [
  { production: 'Meridian', amount: '£14,280', status: 'Approved', crew: 22 },
  { production: 'The Bridge – S3', amount: '£11,940', status: 'Pending', crew: 19 },
  { production: 'Phantom Light', amount: '£6,260', status: 'Approved', crew: 6 },
];

const ragClass: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-400',
  red: 'bg-red-500',
};

const ragLabel: Record<string, string> = {
  green: 'On Track',
  amber: 'Monitor',
  red: 'At Risk',
};

const ragBadge: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
};

const phaseColor: Record<string, string> = {
  'Active Build': 'bg-teal-100 text-teal-700',
  'Pre-Production': 'bg-blue-100 text-blue-700',
  Strike: 'bg-amber-100 text-amber-700',
  Complete: 'bg-slate-100 text-slate-600',
};

export default function DashboardPage() {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <TopBar title="Warren's Dashboard" subtitle={today} />
      <main className="flex-1 p-6 space-y-6">

        {/* Stat Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map(({ label, value, change, up, icon: Icon, color }) => (
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

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Cost Report RAG Summary */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-slate-900 font-semibold text-sm">Cost Report — Active Productions</h2>
                <p className="text-slate-400 text-xs mt-0.5">Budget vs actual spend with RAG status</p>
              </div>
              <button className="text-teal-600 text-xs font-medium flex items-center gap-1 hover:underline">
                View all <ArrowUpRight size={12} />
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {productions.map((p) => (
                <div key={p.name} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-slate-900 text-sm font-semibold">{p.name}</span>
                      <span className="ml-2 text-slate-400 text-xs">{p.type}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 text-xs">{p.spent} / {p.budget}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ragBadge[p.rag]}`}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${ragClass[p.rag]}`} />
                        {ragLabel[p.rag]}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${ragClass[p.rag]}`}
                      style={{ width: `${p.pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-slate-400 text-[10px]">{p.status}</span>
                    <span className="text-slate-400 text-[10px]">{p.pct}% of budget used</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Labour Costs */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-slate-900 font-semibold text-sm">Current Week Labour</h2>
              <p className="text-slate-400 text-xs mt-0.5">Week ending 18 May 2026</p>
            </div>
            <div className="divide-y divide-slate-100">
              {labourCosts.map((l) => (
                <div key={l.production} className="px-5 py-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-slate-800 text-sm font-medium">{l.production}</p>
                    <p className="text-slate-400 text-xs">{l.crew} crew members</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-900 text-sm font-semibold">{l.amount}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${l.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {l.status === 'Approved' ? <><CheckCircle2 size={9} className="inline mr-1" />Approved</> : <><Clock size={9} className="inline mr-1" />Pending</>}
                    </span>
                  </div>
                </div>
              ))}
              <div className="px-5 py-3 bg-slate-50 flex justify-between items-center">
                <span className="text-slate-600 text-xs font-medium">Total This Week</span>
                <span className="text-slate-900 text-sm font-bold">£32,480</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Production Pipeline */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-slate-900 font-semibold text-sm">Production Pipeline</h2>
                <p className="text-slate-400 text-xs mt-0.5">Active & upcoming productions</p>
              </div>
              <button className="text-teal-600 text-xs font-medium flex items-center gap-1 hover:underline">
                View all <ArrowUpRight size={12} />
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-5 py-2.5 text-xs font-semibold text-slate-500">Production</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-slate-500">Phase</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-slate-500">End Date</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-right">Sets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pipeline.map((p) => (
                  <tr key={p.name} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 text-slate-900 font-medium">{p.name}</td>
                    <td className="px-3 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${phaseColor[p.phase] || 'bg-slate-100 text-slate-600'}`}>
                        {p.phase}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-slate-500 text-xs">{p.end}</td>
                    <td className="px-3 py-3.5 text-slate-700 text-xs font-medium text-right">{p.sets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PO Spend Summary */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-slate-900 font-semibold text-sm">Purchase Order Spend</h2>
                <p className="text-slate-400 text-xs mt-0.5">Approved PO spend by production</p>
              </div>
              <button className="text-teal-600 text-xs font-medium flex items-center gap-1 hover:underline">
                View all <ArrowUpRight size={12} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Today vs Week */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-teal-50 rounded-lg p-4">
                  <p className="text-teal-600 text-xs font-medium">Today</p>
                  <p className="text-teal-900 text-xl font-bold mt-1">£4,120</p>
                  <p className="text-teal-500 text-[10px] mt-0.5">3 POs approved</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-slate-500 text-xs font-medium">This Week</p>
                  <p className="text-slate-900 text-xl font-bold mt-1">£32,480</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">18 POs approved</p>
                </div>
              </div>
              {/* By Production */}
              <div className="space-y-2.5">
                {[
                  { name: 'Meridian', amount: '£14,860', pct: 46 },
                  { name: 'The Bridge – S3', amount: '£12,200', pct: 38 },
                  { name: 'Phantom Light', amount: '£5,420', pct: 16 },
                ].map((item) => (
                  <div key={item.name}>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>{item.name}</span>
                      <span className="font-medium">{item.amount}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="h-1.5 bg-teal-500 rounded-full" style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </main>
    </>
  );
}
