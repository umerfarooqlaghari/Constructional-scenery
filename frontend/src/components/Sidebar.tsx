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
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: "Warren's Dashboard", icon: LayoutDashboard },
  { href: '/productions', label: 'Productions', icon: Clapperboard },
  { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
  { href: '/crew', label: 'Crew Database', icon: Users },
  { href: '/timesheets', label: 'Timesheets & Pay Run', icon: ClipboardList },
  { href: '/cost-report', label: 'Cost Report', icon: BarChart2 },
  { href: '/forecasting', label: 'Forecasting', icon: TrendingUp },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-slate-900 flex flex-col z-30">
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
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold px-3 pb-2 pt-1">
          Modules
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
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
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">WL</span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold truncate">Warren Lever</p>
            <p className="text-slate-400 text-[10px] truncate">Managing Director</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
