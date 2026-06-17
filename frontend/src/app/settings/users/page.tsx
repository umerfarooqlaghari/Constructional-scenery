'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi, type ManagedUser } from '@/lib/api';
import {
  Plus, X, Loader2, Shield, UserX, UserCheck, Eye, EyeOff,
} from 'lucide-react';

const ROLES = [
  { value: 'managing_director',        label: 'Managing Director' },
  { value: 'construction_accountant',  label: 'Construction Accountant' },
  { value: 'construction_coordinator', label: 'Construction Coordinator' },
];

const roleLabel = (role: string) => ROLES.find(r => r.value === role)?.label ?? role;

const inputCls =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500';

// ─── New User Modal ────────────────────────────────────────────────────────────

function NewUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!role) { setError('Please select a role.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setSaving(true);
    try {
      await usersApi.create({ email, password, full_name: fullName, role });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-slate-900 font-semibold text-base">New User Account</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
            <input className={inputCls} required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Sarah Thompson" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input type="email" className={inputCls} required value={email} onChange={e => setEmail(e.target.value)} placeholder="sarah@constructscenery.co.uk" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className={inputCls + ' pr-10'}
                required minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
              />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <select className={inputCls + ' bg-white'} required value={role} onChange={e => setRole(e.target.value)}>
              <option value="">Select a role…</option>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function UsersAdminPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [users, setUsers]     = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [showNew, setShowNew] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Guard: only MD may view this page
  useEffect(() => {
    if (currentUser && currentUser.role !== 'managing_director') {
      router.replace('/productions');
    }
  }, [currentUser, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await usersApi.list());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRoleChange = async (u: ManagedUser, role: string) => {
    setUpdatingId(u.id);
    try {
      await usersApi.update(u.id, { role });
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleActive = async (u: ManagedUser) => {
    setUpdatingId(u.id);
    try {
      await usersApi.update(u.id, { is_active: !u.is_active });
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  if (currentUser && currentUser.role !== 'managing_director') return null;

  return (
    <>
      {showNew && (
        <NewUserModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />
      )}
      <TopBar title="User Accounts" subtitle="Create and manage CS HQ accounts and roles" />
      <main className="flex-1 p-4 md:p-6 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-blue-600" />
              <h2 className="text-slate-900 font-semibold text-sm">Accounts</h2>
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-2 bg-blue-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-blue-700 font-medium"
            >
              <Plus size={14} /> New User
            </button>
          </div>

          {error && <div className="px-5 py-4 text-red-600 text-sm bg-red-50 border-b border-red-100">{error}</div>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Email</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Role</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}><td colSpan={5} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse w-full" /></td></tr>
                  ))
                ) : users.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">No accounts found.</td></tr>
                ) : (
                  users.map(u => {
                    const isSelf = u.id === currentUser?.id;
                    const busy = updatingId === u.id;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3.5">
                          <p className="text-slate-900 font-medium">{u.full_name}{isSelf && <span className="text-slate-400 text-xs ml-1.5">(you)</span>}</p>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{u.email}</td>
                        <td className="px-4 py-3.5">
                          <select
                            value={u.role}
                            disabled={busy || isSelf}
                            onChange={e => handleRoleChange(u, e.target.value)}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60"
                          >
                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            {u.is_active ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {!isSelf && (
                            <button
                              onClick={() => handleToggleActive(u)}
                              disabled={busy}
                              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-60 ml-auto"
                            >
                              {busy ? <Loader2 size={12} className="animate-spin" /> : u.is_active ? <UserX size={12} /> : <UserCheck size={12} />}
                              {u.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
