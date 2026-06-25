// ── Role context — provides current user role & permissions ─

'use client';

import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import { RoleDefaultPermissions, type TenantRoleName, type PermissionKey } from '@/rbac/permissions';

interface UserInfo {
  name: string;
  email: string;
  role: TenantRoleName;
}

interface RoleContextValue {
  user: UserInfo;
  role: TenantRoleName;
  permissions: PermissionKey[];
  hasPermission: (perm: PermissionKey) => boolean;
  hasAnyPermission: (perms: PermissionKey[]) => boolean;
  setRole: (role: TenantRoleName) => void;
  isAdmin: boolean;
  isSupervisor: boolean;
  isCommercial: boolean;
  isTechnician: boolean;
}

const defaultUser: UserInfo = {
  name: 'Admin',
  email: 'admin@crm.local',
  role: 'Administrator',
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo>(defaultUser);

  const value = useMemo<RoleContextValue>(() => {
    const role = user.role;
    const permissions = RoleDefaultPermissions[role] ?? [];
    return {
      user,
      role,
      permissions,
      hasPermission: (perm: PermissionKey) => permissions.includes(perm),
      hasAnyPermission: (perms: PermissionKey[]) => perms.some((p) => permissions.includes(p)),
      setRole: (newRole: TenantRoleName) => setUser((prev) => ({ ...prev, role: newRole })),
      isAdmin: role === 'Owner' || role === 'Administrator',
      isSupervisor: role === 'Supervisor',
      isCommercial: role === 'Sales',
      isTechnician: role === 'Technician',
    };
  }, [user]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used inside <RoleProvider>');
  return ctx;
}
