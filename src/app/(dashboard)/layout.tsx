// ── Dashboard layout — wraps all role-based dashboards ─────

import { ReactNode } from 'react';
import DashboardShell from '@/dashboard/components/DashboardShell';
import { AttentionToast } from '@/components/follow-up/AttentionToast';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell>
      {children}
      <AttentionToast />
    </DashboardShell>
  );
}
