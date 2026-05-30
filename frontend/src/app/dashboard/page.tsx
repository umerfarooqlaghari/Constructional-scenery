'use client';

import { useAuth } from '@/contexts/AuthContext';
import MDDashboard from './MDDashboard';
import AccountantDashboard from './AccountantDashboard';
import CoordinatorDashboard from './CoordinatorDashboard';

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role === 'managing_director')       return <MDDashboard />;
  if (user.role === 'construction_accountant') return <AccountantDashboard />;
  if (user.role === 'construction_coordinator') return <CoordinatorDashboard />;

  return null;
}
