'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import {
  Plus, Search, ChevronRight, X, Loader2, Users, UserCheck, Briefcase, Building2,
} from 'lucide-react';
import { crewApi, CrewMember, EmploymentStatus } from '@/lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-teal-500', 'bg-purple-500', 'bg-blue-500', 'bg-pink-500', 'bg-orange-500',
  'bg-green-500', 'bg-indigo-500', 'bg-rose-500', 'bg-cyan-500', 'bg-amber-500',
];

type FilterTab = 'all' | 'paye' | 'self_employed' | 'active' | 'inactive';

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all',           label: 'All' },
  { value: 'paye',          label: 'PAYE' },
  { value: 'self_employed', label: 'Self-Employed' },
  { value: 'active',        label: 'Active' },
  { value: 'inactive',      label: 'Inactive' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

// ─── Register Crew Modal ──────────────────────────────────────────────────────

interface RegisterCrewModalProps {
  onClose: () => void;
  onCreated: () => void;
}

type TradesData = { bectu: Record<string, string[]>; non_bectu: string[] };

function RegisterCrewModal({ onClose, onCreated }: RegisterCrewModalProps) {
  const [trades, setTrades] = useState<TradesData | null>(null);
  const [tradesLoading, setTradesLoading] = useState(true);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    employment_status: 'paye' as EmploymentStatus,
    crew_trade: '',
    crew_rank: '',
    email: '',
    date_of_birth: '',
    company_name: '',
    company_registration_number: '',
    vat_registration_number: '',
    paye_withholding_rate: '20',
    account_name: '',
    account_number: '',
    sort_code: '',
    emergency_contact_name: '',
    emergency_contact_relationship: '',
    emergency_contact_phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    crewApi.getTrades()
      .then(setTrades)
      .catch(() => setTrades({ bectu: {}, non_bectu: [] }))
      .finally(() => setTradesLoading(false));
  }, []);

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm(f => {
      const updated = { ...f, [k]: e.target.value };
      if (k === 'crew_trade') updated.crew_rank = '';
      if (k === 'employment_status') {
        updated.paye_withholding_rate = e.target.value === 'paye' ? '20' : '0';
        updated.crew_trade = '';
        updated.crew_rank = '';
      }
      return updated;
    });
  };

  const isSE = form.employment_status === 'self_employed';

  const allTrades: string[] = trades
    ? [...Object.keys(trades.bectu), ...trades.non_bectu]
    : [];

  const rankOptions: string[] = (() => {
    if (!trades || !form.crew_trade) return [];
    return trades.bectu[form.crew_trade] ?? [];
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('First name and last name are required.');
      return;
    }
    if (!form.crew_trade) {
      setError('Please select a trade.');
      return;
    }
    if (!form.crew_rank.trim()) {
      setError('Please enter or select a rank.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await crewApi.create({
        first_name: form.first_name.trim(),
        last_name:  form.last_name.trim(),
        employment_status: form.employment_status,
        crew_trade:   form.crew_trade   || null,
        crew_rank:    form.crew_rank    || null,
        email:        form.email        || null,
        date_of_birth: form.date_of_birth || null,
        company_name:                isSE ? (form.company_name || null) : null,
        company_registration_number: isSE ? (form.company_registration_number || null) : null,
        vat_registration_number:     isSE ? (form.vat_registration_number || null) : null,
        paye_withholding_rate: form.paye_withholding_rate ? Number(form.paye_withholding_rate) : null,
        account_name:   form.account_name   || null,
        account_number: form.account_number || null,
        sort_code:      form.sort_code      || null,
        emergency_contact_name:         form.emergency_contact_name         || null,
        emergency_contact_relationship: form.emergency_contact_relationship || null,
        emergency_contact_phone:        form.emergency_contact_phone        || null,
      });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register crew member');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-xl z-10">
          <h2 className="text-slate-900 font-semibold text-base">Register Crew Member</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-5">
          {error && (
            <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Personal */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Personal Details</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>First Name *</label>
                <input className={inputCls} placeholder="e.g. James" value={form.first_name} onChange={set('first_name')} />
              </div>
              <div>
                <label className={labelCls}>Last Name *</label>
                <input className={inputCls} placeholder="e.g. Hargreaves" value={form.last_name} onChange={set('last_name')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="col-span-2">
                <label className={labelCls}>Email</label>
                <input type="email" className={inputCls} placeholder="james@example.com" value={form.email} onChange={set('email')} />
              </div>
            </div>
            <div className="mt-4">
              <label className={labelCls}>Date of Birth</label>
              <input type="date" className={inputCls} value={form.date_of_birth} onChange={set('date_of_birth')} />
            </div>
          </div>

          {/* Employment */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Employment</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Employment Status *</label>
                <select className={inputCls} value={form.employment_status} onChange={set('employment_status')}>
                  <option value="paye">PAYE</option>
                  <option value="self_employed">Self-Employed</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Withholding Rate (%)</label>
                <input type="number" min={0} max={100} className={inputCls} value={form.paye_withholding_rate} onChange={set('paye_withholding_rate')} />
              </div>
            </div>

            {tradesLoading ? (
              <div className="mt-4 h-9 bg-slate-100 rounded-lg animate-pulse" />
            ) : (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className={labelCls}>Trade</label>
                  <select className={inputCls} value={form.crew_trade} onChange={set('crew_trade')}>
                    <option value="">— Select trade —</option>
                    {allTrades.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Rank</label>
                  {rankOptions.length > 0 ? (
                    <select className={inputCls} value={form.crew_rank} onChange={set('crew_rank')}>
                      <option value="">— Select rank —</option>
                      {rankOptions.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={inputCls}
                      placeholder="e.g. Senior Carpenter"
                      value={form.crew_rank}
                      onChange={set('crew_rank')}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Self-Employed Company */}
          {isSE && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Company Details</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>Company Name</label>
                  <input className={inputCls} placeholder="e.g. Hargreaves Scenery Ltd" value={form.company_name} onChange={set('company_name')} />
                </div>
                <div>
                  <label className={labelCls}>Company Reg. Number</label>
                  <input className={inputCls} placeholder="e.g. 12345678" value={form.company_registration_number} onChange={set('company_registration_number')} />
                </div>
                <div>
                  <label className={labelCls}>VAT Reg. Number</label>
                  <input className={inputCls} placeholder="e.g. GB123456789" value={form.vat_registration_number} onChange={set('vat_registration_number')} />
                </div>
              </div>
            </div>
          )}

          {/* Bank Details */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Bank Details</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3 sm:col-span-1">
                <label className={labelCls}>Account Name</label>
                <input className={inputCls} placeholder="Name on account" value={form.account_name} onChange={set('account_name')} />
              </div>
              <div>
                <label className={labelCls}>Account Number</label>
                <input className={inputCls} placeholder="12345678" value={form.account_number} onChange={set('account_number')} />
              </div>
              <div>
                <label className={labelCls}>Sort Code</label>
                <input className={inputCls} placeholder="00-00-00" value={form.sort_code} onChange={set('sort_code')} />
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Emergency Contact</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Contact Name</label>
                <input className={inputCls} placeholder="e.g. Sarah Hargreaves" value={form.emergency_contact_name} onChange={set('emergency_contact_name')} />
              </div>
              <div>
                <label className={labelCls}>Relationship</label>
                <input className={inputCls} placeholder="e.g. Spouse" value={form.emergency_contact_relationship} onChange={set('emergency_contact_relationship')} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Contact Phone</label>
                <input type="tel" className={inputCls} placeholder="+44 7700 900000" value={form.emergency_contact_phone} onChange={set('emergency_contact_phone')} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Register Crew Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CrewPage() {
  const router = useRouter();
  const [crew, setCrew]           = useState<CrewMember[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await crewApi.list();
      setCrew(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load crew');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Computed stats
  const totalCrew  = crew.length;
  const activeCrew = crew.filter(c => c.is_active).length;
  const payeCount  = crew.filter(c => c.employment_status === 'paye').length;
  const seCount    = crew.filter(c => c.employment_status === 'self_employed').length;

  // Filter
  const filtered = crew.filter(c => {
    const matchesTab =
      activeTab === 'all'           ? true :
      activeTab === 'paye'          ? c.employment_status === 'paye' :
      activeTab === 'self_employed' ? c.employment_status === 'self_employed' :
      activeTab === 'active'        ? c.is_active :
      /* inactive */                  !c.is_active;

    const q = search.toLowerCase();
    const matchesSearch = !q || [c.first_name, c.last_name, c.crew_trade, c.crew_number]
      .some(v => v?.toLowerCase().includes(q));

    return matchesTab && matchesSearch;
  });

  const stats = [
    { label: 'Total Crew',    value: totalCrew,  icon: <Users size={18} className="text-teal-600" />,      bg: 'bg-teal-50' },
    { label: 'Active',        value: activeCrew, icon: <UserCheck size={18} className="text-green-600" />,  bg: 'bg-green-50' },
    { label: 'PAYE',          value: payeCount,  icon: <Briefcase size={18} className="text-blue-600" />,   bg: 'bg-blue-50' },
    { label: 'Self-Employed', value: seCount,    icon: <Building2 size={18} className="text-purple-600" />, bg: 'bg-purple-50' },
  ];

  return (
    <>
      {showModal && (
        <RegisterCrewModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}

      <TopBar title="Crew Database" subtitle="Register and manage your construction crew" />
      <main className="flex-1 p-6 space-y-5">

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4 shadow-sm flex items-center gap-4">
              <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                {s.icon}
              </div>
              <div>
                {loading
                  ? <div className="h-6 w-10 bg-slate-100 rounded animate-pulse mb-1" />
                  : <p className="text-slate-900 text-2xl font-bold">{s.value}</p>}
                <p className="text-slate-500 text-xs">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-3 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-1 flex-wrap">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${activeTab === tab.value ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 w-56">
                <Search size={13} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Search crew..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none w-full"
                />
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-teal-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-teal-700 transition-colors font-medium whitespace-nowrap"
              >
                <Plus size={14} />
                Register Crew Member
              </button>
            </div>
          </div>

          {error && (
            <div className="px-5 py-4 text-red-600 text-sm bg-red-50 border-b border-red-100">{error}</div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">Crew Member</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Trade &amp; Rank</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Employment</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Company</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Email</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-4">
                          <div className="h-4 bg-slate-100 rounded animate-pulse w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">
                      {search ? 'No crew members match your search.' : 'No crew members found.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((c, idx) => {
                    const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => router.push(`/crew/${c.id}`)}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full ${colorClass} flex items-center justify-center flex-shrink-0`}>
                              <span className="text-white text-xs font-bold">
                                {getInitials(c.first_name, c.last_name)}
                              </span>
                            </div>
                            <div>
                              <p className="text-slate-900 font-medium text-sm">{c.first_name} {c.last_name}</p>
                              <p className="text-slate-400 text-xs font-mono">{c.crew_number}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-slate-700 text-sm">{c.crew_trade ?? '—'}</p>
                          {c.crew_rank && <p className="text-slate-400 text-xs">{c.crew_rank}</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.employment_status === 'paye' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {c.employment_status === 'paye' ? 'PAYE' : 'Self-Employed'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {c.employment_status === 'self_employed' && c.company_name
                            ? <span className="text-slate-700 text-xs">{c.company_name}</span>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-sm">
                          {c.email ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            {c.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={e => { e.stopPropagation(); router.push(`/crew/${c.id}`); }}
                            className="p-1.5 text-teal-500 hover:bg-teal-50 rounded-lg transition-colors"
                          >
                            <ChevronRight size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-slate-400 text-xs">
              {loading
                ? 'Loading…'
                : `Showing ${filtered.length} of ${crew.length} crew member${crew.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>
      </main>
    </>
  );
}
