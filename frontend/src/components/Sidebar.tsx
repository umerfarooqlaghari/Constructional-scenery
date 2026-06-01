'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Clapperboard,
  ShoppingCart,
  Users,
  ClipboardList,
  BarChart2,
  TrendingUp,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const NAV_GROUPS = [
  {
    label: 'Core',
    items: [
      { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard, roles: ['managing_director', 'construction_accountant', 'construction_coordinator'] },
      { href: '/productions', label: 'Productions', icon: Clapperboard,    roles: ['managing_director', 'construction_accountant', 'construction_coordinator'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, roles: ['managing_director', 'construction_coordinator'] },
      { href: '/cost-report',     label: 'Cost Report',     icon: BarChart2,    roles: ['managing_director', 'construction_accountant'] },
      { href: '/forecasting',     label: 'Forecasting',     icon: TrendingUp,   roles: ['managing_director', 'construction_coordinator'] },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/crew',       label: 'Crew',                 icon: Users,        roles: ['managing_director', 'construction_accountant', 'construction_coordinator'] },
      { href: '/timesheets', label: 'Timesheets & Pay Run', icon: ClipboardList, roles: ['managing_director', 'construction_accountant'] },
    ],
  },
];

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

function getRoleLabel(role: string) {
  if (role === 'managing_director')       return 'Managing Director';
  if (role === 'construction_accountant') return 'Construction Accountant';
  if (role === 'construction_coordinator') return 'Construction Coordinator';
  return role;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const visibleGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => !user || item.roles.includes(user.role)),
  })).filter(group => group.items.length > 0);

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 bg-slate-900 flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700/60">
        <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-black tracking-tight">CS</span>
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">CS HQ</p>
          <p className="text-slate-400 text-[10px] leading-tight">Construct Scenery Ltd</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
        {visibleGroups.map(group => (
          <div key={group.label}>
            <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold px-3 pb-1.5">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                      active
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon size={17} className="flex-shrink-0" />
                    <span className="flex-1 truncate">{label}</span>
                    {active && <ChevronRight size={14} className="opacity-70" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="px-4 py-4 border-t border-slate-700/60 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {user ? getInitials(user.full_name) : '?'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-semibold truncate">{user?.full_name ?? '—'}</p>
            <p className="text-slate-400 text-[10px] truncate">{user ? getRoleLabel(user.role) : ''}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white text-xs font-medium transition-all"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
