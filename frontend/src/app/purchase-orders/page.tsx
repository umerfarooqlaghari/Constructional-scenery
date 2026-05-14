import TopBar from '@/components/TopBar';
import { Plus, Search, Filter, Download, CheckCircle2, Clock, AlertCircle, FileText, MoreHorizontal, ChevronDown } from 'lucide-react';

const pos = [
  { id: 'PO-2026-0142', supplier: 'Treeline Timber Co.', supplierAddr: 'Reading, Berkshire', production: 'Meridian', setCode: 'S003', accountCode: 'MAT-001', description: 'Structural timber — set build phase 2', net: 4200, vat: 840, gross: 5040, paidFrom: 'Supplier Account', status: 'Approved', date: '12 May 2026', hasInvoice: true },
  { id: 'PO-2026-0141', supplier: 'Scenic Solutions Ltd', supplierAddr: 'Slough, Berkshire', production: 'The Bridge – S3', setCode: 'S019', accountCode: 'MAT-003', description: 'Scenic paint & finishes — episode 6 sets', net: 1850, vat: 370, gross: 2220, paidFrom: 'Pleo Charge Card', status: 'Approved', date: '11 May 2026', hasInvoice: true },
  { id: 'PO-2026-0140', supplier: 'ProFab Metalworks', supplierAddr: 'Uxbridge, London', production: 'Meridian', setCode: 'S002', accountCode: 'FAB-002', description: 'Steel fabrication — dungeon gates', net: 3100, vat: 620, gross: 3720, paidFrom: 'Arbuthnot Current Account', status: 'Pending Approval', date: '10 May 2026', hasInvoice: true },
  { id: 'PO-2026-0139', supplier: 'Crown Hire & Supply', supplierAddr: 'Watford, Hertfordshire', production: 'The Bridge – S3', setCode: 'S022', accountCode: 'HIRE-001', description: 'Scaffold hire — exterior village set', net: 2400, vat: 480, gross: 2880, paidFrom: 'Charge Card', status: 'Awaiting Invoice', date: '09 May 2026', hasInvoice: false },
  { id: 'PO-2026-0138', supplier: 'Luminos FX Supplies', supplierAddr: 'Borehamwood, Herts', production: 'Phantom Light', setCode: 'S001', accountCode: 'SFX-001', description: 'Atmospheric effect materials', net: 780, vat: 156, gross: 936, paidFrom: 'Pleo Charge Card', status: 'Awaiting Invoice', date: '08 May 2026', hasInvoice: false },
  { id: 'PO-2026-0137', supplier: 'Treeline Timber Co.', supplierAddr: 'Reading, Berkshire', production: 'Meridian', setCode: 'S004', accountCode: 'MAT-001', description: 'Hardwood flooring — tavern interior', net: 1960, vat: 392, gross: 2352, paidFrom: 'Supplier Account', status: 'Approved', date: '07 May 2026', hasInvoice: true },
  { id: 'PO-2026-0136', supplier: 'Colour Box Paints', supplierAddr: 'Luton, Bedfordshire', production: 'The Bridge – S3', setCode: 'S018', accountCode: 'MAT-003', description: 'Specialist coatings & textured finishes', net: 640, vat: 128, gross: 768, paidFrom: 'Pleo Charge Card', status: 'Draft', date: '07 May 2026', hasInvoice: false },
];

const statusConfig: Record<string, { className: string; icon: React.ReactNode }> = {
  'Approved': { className: 'bg-green-100 text-green-700', icon: <CheckCircle2 size={11} className="inline mr-1" /> },
  'Pending Approval': { className: 'bg-amber-100 text-amber-700', icon: <Clock size={11} className="inline mr-1" /> },
  'Awaiting Invoice': { className: 'bg-orange-100 text-orange-700', icon: <AlertCircle size={11} className="inline mr-1" /> },
  'Draft': { className: 'bg-slate-100 text-slate-500', icon: <FileText size={11} className="inline mr-1" /> },
};

const paymentColor: Record<string, string> = {
  'Supplier Account': 'bg-blue-50 text-blue-600',
  'Pleo Charge Card': 'bg-purple-50 text-purple-600',
  'Charge Card': 'bg-pink-50 text-pink-600',
  'Arbuthnot Current Account': 'bg-teal-50 text-teal-600',
};

export default function PurchaseOrdersPage() {
  const total = pos.reduce((s, p) => s + p.gross, 0);
  const approved = pos.filter((p) => p.status === 'Approved').reduce((s, p) => s + p.gross, 0);
  const pending = pos.filter((p) => p.status !== 'Approved' && p.status !== 'Draft').length;

  return (
    <>
      <TopBar title="Purchase Orders" subtitle="Raise, track and approve supplier purchase orders" />
      <main className="flex-1 p-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total POs (This Month)', value: `${pos.length}`, sub: 'across 3 productions' },
            { label: 'Approved Spend', value: `£${approved.toLocaleString()}`, sub: 'inc. VAT' },
            { label: 'Awaiting Action', value: `${pending}`, sub: 'pending approval / invoice' },
            { label: 'Total Committed', value: `£${total.toLocaleString()}`, sub: 'all statuses' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4 shadow-sm">
              <p className="text-slate-500 text-xs font-medium">{s.label}</p>
              <p className="text-slate-900 text-2xl font-bold mt-1">{s.value}</p>
              <p className="text-slate-400 text-xs mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between px-5 py-4 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 w-64">
                <Search size={14} className="text-slate-400" />
                <input type="text" placeholder="Search POs, suppliers..." className="bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none w-full" />
              </div>
              {/* Filters */}
              {['Production', 'Supplier', 'Status', 'Date Range'].map((f) => (
                <button key={f} className="flex items-center gap-1.5 text-slate-600 text-xs border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors">
                  {f} <ChevronDown size={12} />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 text-slate-600 text-sm border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors">
                <Download size={14} />
                Export
              </button>
              <button className="flex items-center gap-2 bg-teal-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-teal-700 transition-colors font-medium">
                <Plus size={14} />
                New PO
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">PO Number</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Supplier</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Production</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Set / Account</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Description</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Net</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">VAT</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Gross</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Paid From</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Invoice</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pos.map((po) => {
                  const sc = statusConfig[po.status];
                  return (
                    <tr key={po.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer">
                      <td className="px-5 py-3.5">
                        <p className="text-teal-700 font-semibold text-xs font-mono">{po.id}</p>
                        <p className="text-slate-400 text-[10px] mt-0.5">{po.date}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-slate-800 font-medium text-sm">{po.supplier}</p>
                        <p className="text-slate-400 text-xs">{po.supplierAddr}</p>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 text-sm whitespace-nowrap">{po.production}</td>
                      <td className="px-4 py-3.5">
                        <p className="text-slate-700 text-xs font-mono">{po.setCode}</p>
                        <p className="text-slate-400 text-xs">{po.accountCode}</p>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 text-xs max-w-[180px] truncate">{po.description}</td>
                      <td className="px-4 py-3.5 text-slate-700 text-sm text-right font-medium">£{po.net.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-slate-500 text-sm text-right">£{po.vat.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-slate-900 text-sm text-right font-semibold">£{po.gross.toLocaleString()}</td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${paymentColor[po.paidFrom] || 'bg-slate-100 text-slate-600'}`}>
                          {po.paidFrom}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {po.hasInvoice
                          ? <CheckCircle2 size={16} className="text-green-500 mx-auto" />
                          : <AlertCircle size={16} className="text-orange-400 mx-auto" />}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${sc.className}`}>
                          {sc.icon}{po.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <button className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                          <MoreHorizontal size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-slate-400 text-xs">Showing 7 of 142 purchase orders</span>
            <div className="flex items-center gap-1">
              <button className="px-2.5 py-1 text-xs text-slate-500 border border-slate-200 rounded-md hover:bg-white">Previous</button>
              <button className="px-2.5 py-1 text-xs bg-teal-600 text-white rounded-md">1</button>
              <button className="px-2.5 py-1 text-xs text-slate-500 border border-slate-200 rounded-md hover:bg-white">2</button>
              <button className="px-2.5 py-1 text-xs text-slate-500 border border-slate-200 rounded-md hover:bg-white">Next</button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
