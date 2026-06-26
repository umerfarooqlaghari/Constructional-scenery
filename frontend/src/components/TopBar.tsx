'use client';

import { Bell, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface TopBarProps {
  title: string;
  subtitle?: string;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

export default function TopBar({ title, subtitle }: TopBarProps) {
  const { user } = useAuth();

  return (
    <header className="h-14 md:h-16 bg-white border-b border-slate-200 flex items-center px-4 md:px-6 gap-3 sticky top-0 z-20">
      {/* Mobile: logo */}
      <img src="/deepsian favicon.png" alt="Construct Scenery Database" className="md:hidden w-7 h-7 rounded-lg object-cover flex-shrink-0" />

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-slate-900 font-semibold text-base md:text-lg leading-tight truncate">{title}</h1>
        {subtitle && <p className="hidden sm:block text-slate-500 text-xs truncate">{subtitle}</p>}
      </div>

      {/* Desktop-only actions */}
      <div className="hidden md:flex items-center gap-1">
        <button className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full" />
        </button>
        <button className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
          <Settings size={18} />
        </button>
        <div className="ml-2 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0" title={user?.full_name}>
          <span className="text-white text-xs font-bold">
            {user ? getInitials(user.full_name) : '?'}
          </span>
        </div>
      </div>
    </header>
  );
}
