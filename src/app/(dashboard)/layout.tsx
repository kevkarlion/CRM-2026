// ── Dashboard layout — wraps all role-based dashboards ─────

import { ReactNode } from 'react';
import DashboardShell from '@/dashboard/components/DashboardShell';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
