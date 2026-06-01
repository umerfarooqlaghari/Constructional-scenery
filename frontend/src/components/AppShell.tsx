'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { useAuth } from '@/contexts/AuthContext';

const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/verify-otp', '/reset-password'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, loading } = useAuth();

  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (loading) return;
    if (!isAuthPage && !user) router.replace('/login');
    if (isAuthPage && user)   router.replace('/dashboard');
  }, [loading, user, isAuthPage, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        {children}
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar />

      {/* Main content: no left pad on mobile, pl-60 on desktop */}
      <div className="md:pl-60 min-h-screen flex flex-col pb-16 md:pb-0">
        {children}
      </div>

      {/* Mobile bottom nav — hidden on desktop */}
      <BottomNav />
    </>
  );
}
