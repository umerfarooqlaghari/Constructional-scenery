import TopBar from '@/components/TopBar';
import { Plus, Search, Filter, Calendar, MapPin, CheckCircle2, Clock, AlertTriangle, ChevronRight, MoreHorizontal } from 'lucide-react';

const productions = [
  {
    id: 1,
    name: 'Meridian',
    company: 'Lionsgate UK',
    designer: 'Helena Portman',
    type: 'Feature Film',
    contractType: 'On a Price',
    status: 'Active Build',
    start: '14 Jan 2026',
    end: '28 Jun 2026',
    sets: { total: 18, complete: 11, inProgress: 5, notStarted: 2 },
    daysRemaining: 46,
    coordinator: 'James Morley',
  },
  {
    id: 2,
    name: 'The Bridge – Series 3',
    company: 'Wall to Wall Media',
    designer: 'Sarah Okonkwo',
    type: 'TV Series',
    contractType: 'Cost Plus',
    status: 'Active Build',
    start: '03 Mar 2026',
    end: '05 Jul 2026',
    sets: { total: 24, complete: 20, inProgress: 3, notStarted: 1 },
    daysRemaining: 53,
    coordinator: 'Claire Dixon',
  },
  {
    id: 3,
    name: 'Phantom Light',
    company: 'eOne Productions',
    designer: 'Richard Alderton',
    type: 'Feature Film',
    contractType: 'On a Price',
    status: 'Pre-Production',
    start: '01 Jun 2026',
    end: '15 Nov 2026',
    sets: { total: 11, complete: 0, inProgress: 1, notStarted: 10 },
    daysRemaining: 186,
    coordinator: 'James Morley',
  },
  {
    id: 4,
    name: 'Say Nothing – S2',
    company: 'Hulu / FX',
    designer: "Aoife O'Sullivan",
    type: 'SVOD',
    contractType: 'Cost Plus',
    status: 'Strike',
    start: '10 Sep 2025',
    end: '04 Apr 2026',
    sets: { total: 31, complete: 31, inProgress: 0, notStarted: 0 },
    daysRemaining: 0,
    coordinator: 'Claire Dixon',
  },
  {
    id: 5,
    name: 'Dark Harvest',
    company: 'BBC Studios',
    designer: 'Tom Whitfield',
    type: 'TV Drama',
    contractType: 'On a Price',
    status: 'Complete',
    start: '05 May 2025',
    end: '22 Jan 2026',
    sets: { total: 14, complete: 14, inProgress: 0, notStarted: 0 },
    daysRemaining: 0,
    coordinator: 'James Morley',
  },
];

const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  'Pre-Production': { label: 'Pre-Production', className: 'bg-blue-100 text-blue-700', icon: <Clock size={11} className="inline mr-1" /> },
  'Active Build': { label: 'Active Build', className: 'bg-teal-100 text-teal-700', icon: <CheckCircle2 size={11} className="inline mr-1" /> },
  Strike: { label: 'Strike', className: 'bg-amber-100 text-amber-700', icon: <AlertTriangle size={11} className="inline mr-1" /> },
  Complete: { label: 'Complete', className: 'bg-slate-100 text-slate-500', icon: <CheckCircle2 size={11} className="inline mr-1" /> },
};

const daysColor = (days: number, status: string) => {
  if (status === 'Complete' || status === 'Strike') return 'text-slate-400';
  if (days <= 14) return 'text-red-600 font-semibold';
  if (days <= 30) return 'text-amber-600 font-semibold';
  return 'text-green-600 font-semibold';
};

export default function ProductionsPage() {
  return (
    <>
      <TopBar title="Productions" subtitle="Manage active, upcoming and archived productions" />
      <main className="flex-1 p-6 space-y-5">

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Build', count: 2, color: 'bg-teal-500' },
            { label: 'Pre-Production', count: 1, color: 'bg-blue-500' },
            { label: 'Strike', count: 1, color: 'bg-amber-500' },
            { label: 'Complete', count: 1, color: 'bg-slate-400' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4 shadow-sm flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${s.color} flex-shrink-0`} />
              <div>
                <p className="text-slate-900 text-xl font-bold">{s.count}</p>
                <p className="text-slate-500 text-xs">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 gap-4">
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 w-72">
              <Search size={14} className="text-slate-400" />
              <input type="text" placeholder="Search productions..." className="bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none w-full" />
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 text-slate-600 text-sm border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors">
                <Filter size={14} />
                Filter
              </button>
              <button className="flex items-center gap-2 bg-teal-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-teal-700 transition-colors font-medium">
                <Plus size={14} />
                New Production
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">Production</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Contract</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Dates</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Sets Progress</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Days Left</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Coordinator</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productions.map((p) => {
                  const donePct = p.sets.total > 0 ? Math.round((p.sets.complete / p.sets.total) * 100) : 0;
                  const sc = statusConfig[p.status];
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer">
                      <td className="px-5 py-4">
                        <p className="text-slate-900 font-semibold">{p.name}</p>
                        <p className="text-slate-400 text-xs mt-0.5">{p.company}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-600 text-xs whitespace-nowrap">{p.type}</td>
                      <td className="px-4 py-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.contractType === 'Cost Plus' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                          {p.contractType}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${sc.className}`}>
                          {sc.icon}{sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-500 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={11} className="text-slate-400" />
                          {p.start} – {p.end}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-100 rounded-full h-1.5">
                            <div className="h-1.5 bg-teal-500 rounded-full" style={{ width: `${donePct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500">{p.sets.complete}/{p.sets.total}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-sm ${daysColor(p.daysRemaining, p.status)}`}>
                          {p.status === 'Complete' ? '—' : p.status === 'Strike' ? 'Wrapping' : `${p.daysRemaining}d`}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600 text-xs">{p.coordinator}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <button className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors">
                            <ChevronRight size={15} />
                          </button>
                          <button className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                            <MoreHorizontal size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-slate-400 text-xs">Showing 5 productions · 1 archived</span>
            <div className="flex items-center gap-1">
              <button className="px-2.5 py-1 text-xs text-slate-500 border border-slate-200 rounded-md hover:bg-white transition-colors">Previous</button>
              <button className="px-2.5 py-1 text-xs bg-teal-600 text-white rounded-md">1</button>
              <button className="px-2.5 py-1 text-xs text-slate-500 border border-slate-200 rounded-md hover:bg-white transition-colors">Next</button>
            </div>
          </div>
        </div>

        {/* Set Tracker Preview */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-slate-900 font-semibold text-sm">Set Tracker — Meridian</h2>
              <p className="text-slate-400 text-xs mt-0.5">18 sets · 11 complete · 46 days to final handover</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> Comfortable
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block ml-2" /> Approaching
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block ml-2" /> Imminent
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-5 py-2.5 text-xs font-semibold text-slate-500">Set #</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Set Name</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Shoot Week</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Handover Date</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Status</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-center">Countdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { num: 'S001', name: 'Interior Castle Great Hall', week: 'W/E 18 May', handover: '16 May 2026', status: 'Handed Over', days: -2 },
                  { num: 'S002', name: 'Dungeon Corridor', week: 'W/E 25 May', handover: '22 May 2026', status: 'Nearing Completion', days: 9 },
                  { num: 'S003', name: 'Village Market Square', week: 'W/E 01 Jun', handover: '29 May 2026', status: 'In Progress', days: 16 },
                  { num: 'S004', name: 'Tavern Interior', week: 'W/E 08 Jun', handover: '05 Jun 2026', status: 'In Progress', days: 23 },
                  { num: 'S005', name: 'Forest Clearing', week: 'W/E 15 Jun', handover: '12 Jun 2026', status: 'Not Started', days: 30 },
                ].map((s) => {
                  const dotColor = s.days < 0 ? 'bg-slate-300' : s.days <= 7 ? 'bg-red-500' : s.days <= 14 ? 'bg-amber-400' : 'bg-green-400';
                  const countdownText = s.days < 0 ? 'Done' : `${s.days}d`;
                  const countdownColor = s.days < 0 ? 'text-slate-400' : s.days <= 7 ? 'text-red-600 font-bold' : s.days <= 14 ? 'text-amber-600 font-semibold' : 'text-green-600';
                  const statusBadge: Record<string, string> = {
                    'Handed Over': 'bg-slate-100 text-slate-500',
                    'Nearing Completion': 'bg-amber-100 text-amber-700',
                    'In Progress': 'bg-blue-100 text-blue-700',
                    'Not Started': 'bg-slate-100 text-slate-400',
                    'Complete': 'bg-green-100 text-green-700',
                  };
                  return (
                    <tr key={s.num} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-slate-500 text-xs font-mono">{s.num}</td>
                      <td className="px-4 py-3 text-slate-800 font-medium text-sm">{s.name}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{s.week}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={11} className="text-slate-400" />{s.handover}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[s.status] || 'bg-slate-100 text-slate-500'}`}>{s.status}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} />
                          <span className={`text-sm ${countdownColor}`}>{countdownText}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </>
  );
}
