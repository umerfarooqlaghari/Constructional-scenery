import TopBar from '@/components/TopBar';
import { Send, Download, FileText, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Mail, ChevronDown, Plus } from 'lucide-react';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dates = ['11 May', '12 May', '13 May', '14 May', '15 May', '16 May', '17 May'];

type DayEntry = { worked: boolean; ot: number; set: string; travel: boolean; meals: string[] };

const crewTimesheets: Array<{
  id: string; name: string; initials: string; color: string; rank: string; trade: string;
  employment: string; company: string | null;
  dailyRate: number; entries: DayEntry[]; invoiceAttached: boolean; status: string;
}> = [
  {
    id: 'C-0041', name: 'Marcus Webb', initials: 'MW', color: 'bg-teal-500', rank: 'HOD', trade: 'Carpenters', employment: 'PAYE', company: null, dailyRate: 448,
    entries: [
      { worked: true, ot: 2, set: 'S003', travel: false, meals: ['L'] },
      { worked: true, ot: 0, set: 'S003', travel: false, meals: ['L'] },
      { worked: true, ot: 1.5, set: 'S004', travel: false, meals: ['B', 'L'] },
      { worked: true, ot: 0, set: 'S004', travel: true, meals: ['L'] },
      { worked: true, ot: 0, set: 'S003', travel: false, meals: ['L'] },
      { worked: false, ot: 0, set: '', travel: false, meals: [] },
      { worked: false, ot: 0, set: '', travel: false, meals: [] },
    ],
    invoiceAttached: false, status: 'Distributed',
  },
  {
    id: 'C-0042', name: 'Siobhan Carr', initials: 'SC', color: 'bg-purple-500', rank: 'HOD', trade: 'Scenic Painters', employment: 'Self-Employed', company: 'SC Creative Ltd', dailyRate: 448,
    entries: [
      { worked: true, ot: 0, set: 'S002', travel: false, meals: ['L'] },
      { worked: true, ot: 0, set: 'S002', travel: false, meals: ['L'] },
      { worked: true, ot: 0, set: 'S002', travel: false, meals: ['L'] },
      { worked: true, ot: 3, set: 'S002', travel: false, meals: ['L', 'S'] },
      { worked: true, ot: 0, set: 'S002', travel: false, meals: ['L'] },
      { worked: false, ot: 0, set: '', travel: false, meals: [] },
      { worked: false, ot: 0, set: '', travel: false, meals: [] },
    ],
    invoiceAttached: true, status: 'Invoice Received',
  },
  {
    id: 'C-0043', name: 'Danny Obi', initials: 'DO', color: 'bg-blue-500', rank: 'Chargehand', trade: 'Carpenters', employment: 'PAYE', company: null, dailyRate: 388,
    entries: [
      { worked: true, ot: 0, set: 'S003', travel: true, meals: ['L'] },
      { worked: true, ot: 0, set: 'S003', travel: true, meals: ['L'] },
      { worked: false, ot: 0, set: '', travel: false, meals: [] },
      { worked: true, ot: 0, set: 'S003', travel: true, meals: ['L'] },
      { worked: true, ot: 2, set: 'S003', travel: true, meals: ['L', 'S'] },
      { worked: true, ot: 0, set: 'S003', travel: false, meals: [] },
      { worked: false, ot: 0, set: '', travel: false, meals: [] },
    ],
    invoiceAttached: false, status: 'Distributed',
  },
];

function calcGross(ts: typeof crewTimesheets[0]) {
  const daysWorked = ts.entries.filter((e) => e.worked).length;
  const totalOt = ts.entries.reduce((s, e) => s + e.ot, 0);
  const labourNet = daysWorked * ts.dailyRate + totalOt * (ts.dailyRate / 7.5);
  const vat = ts.employment === 'Self-Employed' ? labourNet * 0.2 : 0;
  return { daysWorked, totalOt, labourNet: Math.round(labourNet), vat: Math.round(vat), gross: Math.round(labourNet + vat) };
}

const statusColor: Record<string, string> = {
  'Draft': 'bg-slate-100 text-slate-500',
  'Distributed': 'bg-blue-100 text-blue-700',
  'Invoice Received': 'bg-green-100 text-green-700',
  'Verified': 'bg-teal-100 text-teal-700',
};

export default function TimesheetsPage() {
  return (
    <>
      <TopBar title="Timesheets & Pay Run" subtitle="Weekly timesheet preparation and pay run management" />
      <main className="flex-1 p-6 space-y-5">

        {/* Week Selector + Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-4 py-2.5 shadow-sm">
              <button className="p-0.5 text-slate-400 hover:text-slate-700"><ChevronLeft size={16} /></button>
              <span className="text-slate-900 font-semibold text-sm px-2">Week Ending: Sunday 18 May 2026</span>
              <button className="p-0.5 text-slate-400 hover:text-slate-700"><ChevronRight size={16} /></button>
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2.5 shadow-sm">
              <span className="text-slate-600 text-sm">Production:</span>
              <button className="flex items-center gap-1.5 text-slate-900 text-sm font-medium">
                Meridian <ChevronDown size={14} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 text-slate-600 text-sm border border-slate-200 bg-white rounded-lg px-3 py-2 hover:bg-slate-50 shadow-sm">
              <Mail size={14} />
              Chase Invoices
            </button>
            <button className="flex items-center gap-2 text-slate-600 text-sm border border-slate-200 bg-white rounded-lg px-3 py-2 hover:bg-slate-50 shadow-sm">
              <FileText size={14} />
              Verification Pack
            </button>
            <button className="flex items-center gap-2 text-slate-600 text-sm border border-slate-200 bg-white rounded-lg px-3 py-2 hover:bg-slate-50 shadow-sm">
              <Download size={14} />
              Pay Run CSV
            </button>
            <button className="flex items-center gap-2 bg-teal-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-teal-700 font-medium">
              <Send size={14} />
              Bulk Send
            </button>
          </div>
        </div>

        {/* Week Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Crew on Sheet', value: '22', sub: 'this production' },
            { label: 'Invoices Received', value: '14 / 22', sub: '8 outstanding' },
            { label: 'Total Labour (Net)', value: '£14,280', sub: 'ex. VAT' },
            { label: 'Total Gross', value: '£15,906', sub: 'inc. self-employed VAT' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4 shadow-sm">
              <p className="text-slate-500 text-xs font-medium">{s.label}</p>
              <p className="text-slate-900 text-xl font-bold mt-1">{s.value}</p>
              <p className="text-slate-400 text-xs mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Timesheet Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-slate-900 font-semibold text-sm">Timesheet Grid — Week Ending 18 May 2026</h2>
            <button className="flex items-center gap-2 text-teal-600 text-sm font-medium hover:underline">
              <Plus size={14} /> Add Crew Member
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              {/* Header */}
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 text-left min-w-[180px]">Crew Member</th>
                  {days.map((d, i) => (
                    <th key={d} className="px-3 py-3 text-xs font-semibold text-slate-500 text-center min-w-[80px]">
                      <span className="block">{d}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{dates[i]}</span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Days</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">OT Hrs</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Net</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Gross</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Invoice</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {crewTimesheets.map((ts) => {
                  const { daysWorked, totalOt, labourNet, vat, gross } = calcGross(ts);
                  return (
                    <tr key={ts.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full ${ts.color} flex items-center justify-center flex-shrink-0`}>
                            <span className="text-white text-[10px] font-bold">{ts.initials}</span>
                          </div>
                          <div>
                            <p className="text-slate-900 font-semibold text-xs">{ts.name}</p>
                            <p className="text-slate-400 text-[10px]">{ts.rank} · {ts.trade}</p>
                          </div>
                        </div>
                      </td>
                      {ts.entries.map((entry, i) => (
                        <td key={i} className="px-3 py-3 text-center">
                          {entry.worked ? (
                            <div>
                              <div className="w-5 h-5 bg-teal-500 rounded mx-auto flex items-center justify-center">
                                <CheckCircle2 size={11} className="text-white" />
                              </div>
                              {entry.ot > 0 && <span className="text-[9px] text-orange-500 font-bold block mt-0.5">+{entry.ot}h</span>}
                              {entry.set && <span className="text-[9px] text-slate-400 block">{entry.set}</span>}
                            </div>
                          ) : (
                            <div className="w-5 h-5 border-2 border-slate-200 rounded mx-auto" />
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-slate-700 text-sm text-right font-medium">{daysWorked}</td>
                      <td className="px-4 py-3 text-slate-600 text-sm text-right">{totalOt > 0 ? totalOt : '—'}</td>
                      <td className="px-4 py-3 text-slate-700 text-sm text-right font-medium">£{labourNet.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-900 text-sm text-right font-semibold">£{gross.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        {ts.invoiceAttached
                          ? <CheckCircle2 size={15} className="text-green-500 mx-auto" />
                          : <AlertCircle size={15} className="text-orange-400 mx-auto" />}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor[ts.status]}`}>{ts.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-5 py-3 text-slate-700 text-xs font-bold" colSpan={8}>Weekly Totals</td>
                  <td className="px-4 py-3 text-slate-900 text-sm font-bold text-right">
                    {crewTimesheets.reduce((s, ts) => s + calcGross(ts).daysWorked, 0)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-sm text-right">
                    {crewTimesheets.reduce((s, ts) => s + calcGross(ts).totalOt, 0)}
                  </td>
                  <td className="px-4 py-3 text-slate-900 text-sm font-bold text-right">
                    £{crewTimesheets.reduce((s, ts) => s + calcGross(ts).labourNet, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-900 text-sm font-bold text-right">
                    £{crewTimesheets.reduce((s, ts) => s + calcGross(ts).gross, 0).toLocaleString()}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Pay Run Tab Preview */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-slate-900 font-semibold text-sm">Pay Run — Week Ending 18 May 2026</h2>
              <p className="text-slate-400 text-xs mt-0.5">CSV export ready for banking platform upload</p>
            </div>
            <button className="flex items-center gap-2 bg-teal-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-teal-700 font-medium">
              <Download size={14} />
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-2.5 text-xs font-semibold text-slate-500 text-left">Crew Member</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-left">Account Name</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Sort Code</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Account No.</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-right">Gross</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-right">Withholding</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-right font-bold">Pay Amount</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { name: 'Marcus Webb', account: 'M Webb', sort: '20-44-81', acNo: '****4421', gross: 2654, withholding: 531, pay: 2123, ref: 'MERIDIAN-WE18MAY26', type: 'PAYE' },
                  { name: 'Siobhan Carr', account: 'SC Creative Ltd', sort: '60-12-53', acNo: '****7789', gross: 2984, withholding: 0, pay: 2984, ref: 'MERIDIAN-WE18MAY26', type: 'SE' },
                  { name: 'Danny Obi', account: 'D Obi', sort: '09-01-26', acNo: '****3312', gross: 1940, withholding: 388, pay: 1552, ref: 'MERIDIAN-WE18MAY26', type: 'PAYE' },
                ].map((r) => (
                  <tr key={r.name} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-slate-800 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{r.account}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-mono text-center">{r.sort}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-mono text-center">{r.acNo}</td>
                    <td className="px-4 py-3 text-slate-600 text-sm text-right">£{r.gross.toLocaleString()}</td>
                    <td className="px-4 py-3 text-red-500 text-sm text-right">{r.withholding > 0 ? `-£${r.withholding.toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3 text-slate-900 text-sm text-right font-bold">£{r.pay.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono">{r.ref}</td>
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
