import TopBar from '@/components/TopBar';
import { Plus, Search, Filter, ChevronDown, MoreHorizontal, CheckCircle2, FileText, Building2 } from 'lucide-react';

const crew = [
  { id: 'C-0041', firstName: 'Marcus', lastName: 'Webb', dob: '14 Mar 1984', trade: 'Carpenters', rank: 'HOD', dept: 'Construction', employment: 'PAYE', company: null, productions: ['Meridian', 'The Bridge – S3'], status: 'Active', initials: 'MW', color: 'bg-teal-500' },
  { id: 'C-0042', firstName: 'Siobhan', lastName: 'Carr', dob: '02 Sep 1990', trade: 'Scenic Painters', rank: 'HOD', dept: 'Paint', employment: 'Self-Employed', company: 'SC Creative Ltd', productions: ['Meridian'], status: 'Active', initials: 'SC', color: 'bg-purple-500' },
  { id: 'C-0043', firstName: 'Danny', lastName: 'Obi', dob: '27 Nov 1987', trade: 'Carpenters', rank: 'Chargehand', dept: 'Construction', employment: 'PAYE', company: null, productions: ['Meridian', 'Phantom Light'], status: 'Active', initials: 'DO', color: 'bg-blue-500' },
  { id: 'C-0044', firstName: 'Priya', lastName: 'Sharma', dob: '15 Jun 1995', trade: 'Riggers', rank: 'Rigger', dept: 'Rigging', employment: 'Self-Employed', company: 'PS Rigging Solutions', productions: ['The Bridge – S3'], status: 'Active', initials: 'PS', color: 'bg-pink-500' },
  { id: 'C-0045', firstName: 'Tom', lastName: 'Hartley', dob: '08 Feb 1979', trade: 'Sculptors', rank: 'Sculptor', dept: 'Sculpt', employment: 'Self-Employed', company: 'Hartley Sculpt Ltd', productions: ['Meridian'], status: 'Active', initials: 'TH', color: 'bg-orange-500' },
  { id: 'C-0046', firstName: 'Andrea', lastName: 'Muñoz', dob: '30 Jul 1993', trade: 'Stagehands', rank: 'Stagehand', dept: 'Construction', employment: 'PAYE', company: null, productions: ['The Bridge – S3', 'Phantom Light'], status: 'Active', initials: 'AM', color: 'bg-green-500' },
  { id: 'C-0047', firstName: 'Lee', lastName: 'Thornton', dob: '21 Dec 1981', trade: 'Metal Workers', rank: 'HOD', dept: 'Metalwork', employment: 'Self-Employed', company: 'Thornton Fabrications Ltd', productions: ['Meridian'], status: 'Active', initials: 'LT', color: 'bg-indigo-500' },
  { id: 'C-0048', firstName: 'Kezia', lastName: 'Asante', dob: '09 Apr 1998', trade: 'Scenic Painters', rank: 'Painter', dept: 'Paint', employment: 'PAYE', company: null, productions: ['The Bridge – S3'], status: 'Active', initials: 'KA', color: 'bg-rose-500' },
  { id: 'C-0049', firstName: 'Rob', lastName: 'Finch', dob: '18 Aug 1976', trade: 'Plasterers', rank: 'HOD', dept: 'Plaster', employment: 'Self-Employed', company: 'Finch Plaster Co.', productions: ['Phantom Light'], status: 'Active', initials: 'RF', color: 'bg-cyan-500' },
  { id: 'C-0050', firstName: 'Natalie', lastName: 'Cross', dob: '03 Jan 1988', trade: 'Carpenters', rank: 'Carpenter', dept: 'Construction', employment: 'PAYE', company: null, productions: ['Meridian', 'The Bridge – S3'], status: 'Active', initials: 'NC', color: 'bg-amber-500' },
];

export default function CrewPage() {
  return (
    <>
      <TopBar title="Crew Database" subtitle="Central personnel record — gateway to timesheets" />
      <main className="flex-1 p-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Crew Records', value: '147', sub: 'all time' },
            { label: 'Active This Week', value: '47', sub: 'across 3 productions' },
            { label: 'PAYE', value: '29', sub: '62% of active' },
            { label: 'Self-Employed', value: '18', sub: '38% of active' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4 shadow-sm">
              <p className="text-slate-500 text-xs font-medium">{s.label}</p>
              <p className="text-slate-900 text-2xl font-bold mt-1">{s.value}</p>
              <p className="text-slate-400 text-xs mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between px-5 py-4 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 w-64">
                <Search size={14} className="text-slate-400" />
                <input type="text" placeholder="Search crew..." className="bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none w-full" />
              </div>
              {['Trade', 'Employment', 'Production'].map((f) => (
                <button key={f} className="flex items-center gap-1.5 text-slate-600 text-xs border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors">
                  {f} <ChevronDown size={12} />
                </button>
              ))}
              <button className="flex items-center gap-1.5 text-slate-600 text-xs border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors">
                <Filter size={12} /> More filters
              </button>
            </div>
            <button className="flex items-center gap-2 bg-teal-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-teal-700 transition-colors font-medium">
              <Plus size={14} />
              Register Crew Member
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">Crew Member</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Crew #</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Trade & Rank</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Department</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Employment</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Productions</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Documents</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {crew.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full ${c.color} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white text-xs font-bold">{c.initials}</span>
                        </div>
                        <div>
                          <p className="text-slate-900 font-semibold">{c.firstName} {c.lastName}</p>
                          <p className="text-slate-400 text-xs">DOB: {c.dob}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs font-mono">{c.id}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-slate-800 text-sm font-medium">{c.rank}</p>
                      <p className="text-slate-400 text-xs">{c.trade}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 text-sm">{c.dept}</td>
                    <td className="px-4 py-3.5">
                      <div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.employment === 'PAYE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {c.employment}
                        </span>
                        {c.company && (
                          <div className="flex items-center gap-1 mt-1">
                            <Building2 size={10} className="text-slate-400" />
                            <p className="text-slate-400 text-[10px] truncate max-w-[110px]">{c.company}</p>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {c.productions.map((p) => (
                          <span key={p} className="text-[10px] px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded font-medium">{p}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={13} className="text-green-500" />
                          <FileText size={13} className="text-green-500" />
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Active</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <button className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                        <MoreHorizontal size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-slate-400 text-xs">Showing 10 of 147 crew members</span>
            <div className="flex items-center gap-1">
              <button className="px-2.5 py-1 text-xs text-slate-500 border border-slate-200 rounded-md hover:bg-white">Previous</button>
              <button className="px-2.5 py-1 text-xs bg-teal-600 text-white rounded-md">1</button>
              <button className="px-2.5 py-1 text-xs text-slate-500 border border-slate-200 rounded-md hover:bg-white">2</button>
              <button className="px-2.5 py-1 text-xs text-slate-500 border border-slate-200 rounded-md hover:bg-white">...</button>
              <button className="px-2.5 py-1 text-xs text-slate-500 border border-slate-200 rounded-md hover:bg-white">15</button>
              <button className="px-2.5 py-1 text-xs text-slate-500 border border-slate-200 rounded-md hover:bg-white">Next</button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
