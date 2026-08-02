// ── RoleGuard — restricts a page to specific roles ────────

'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '@/dashboard/context/role-context';
import type { TenantRoleName } from '@/rbac/permissions';

// Default landing dashboard per role (mirrors login redirect logic)
const ROLE_HOME: Partial<Record<TenantRoleName, string>> = {
  Owner: '/dashboard/admin',
  Administrator: '/dashboard/admin',
  Supervisor: '/dashboard/supervisor',
  Dispatcher: '/dashboard/supervisor',
  Sales: '/dashboard/commercial',
  Technician: '/dashboard/technician',
};

interface RoleGuardProps {
  allowedRoles: TenantRoleName[];
  children: ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { role, loading } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!allowedRoles.includes(role)) {
      router.replace(ROLE_HOME[role] ?? '/dashboard');
    }
  }, [role, loading, allowedRoles, router]);

  if (loading || !allowedRoles.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
