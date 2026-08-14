// ── Role context — provides current user role & permissions ─

'use client';

import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from 'react';
import { RoleDefaultPermissions, type TenantRoleName, type PermissionKey } from '@/rbac/permissions';

interface UserInfo {
  name: string;
  email: string;
  role: TenantRoleName;
  _isDefault?: boolean;
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
  loading: boolean;
}

function decodeToken(token: string): { userId?: string; tenantId?: string; roles?: string[]; name?: string; email?: string } | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    
    // Check expiration
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return null; // Token expired
    }
    
    return {
      userId: decoded.userId ?? decoded.sub,
      tenantId: decoded.tenantId,
      roles: decoded.roles ?? [],
      name: decoded.name ?? 'Usuario',
      email: decoded.email ?? '',
    };
  } catch {
    return null;
  }
}

// Map short role names to full role names
function normalizeRole(role: string): TenantRoleName {
  const roleMap: Record<string, TenantRoleName> = {
    'admin': 'Administrator',
    'owner': 'Owner',
    'superadmin': 'Owner',
    'supervisor': 'Supervisor',
    'sales': 'Sales',
    'commercial': 'Sales',
    'accounting': 'Accounting',
    'accountant': 'Accounting',
    'dispatcher': 'Dispatcher',
    'technician': 'Technician',
    'tech': 'Technician',
  };
  return roleMap[role.toLowerCase()] ?? 'Administrator';
}

const defaultUser: UserInfo = {
  name: '',
  email: '',
  role: 'Administrator' as TenantRoleName, // Default for SSR
  _isDefault: true, // Mark as default to detect SSR vs client mismatch
};

const STORAGE_KEY = 'crm_user_info';

function getCachedUser(): UserInfo | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserInfo;
  } catch {
    return null;
  }
}

function setCachedUser(user: UserInfo) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const cached = getCachedUser();
  const [user, setUser] = useState<UserInfo>(cached ?? defaultUser);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // If we already have a cached user (set from login response), prefer it over JWT decoding
      const existing = getCachedUser();
      if (existing && !existing._isDefault && existing.name && existing.name !== 'Admin') {
        // Normalize role from cache — login response may have 'technician' instead of 'Technician'
        setUser({ ...existing, role: normalizeRole(existing.role) });
        setLoading(false);
        return;
      }

      const data = decodeToken(token);
      
      if (!data) {
        // Token expired or invalid - redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }
      
      // Normalize role: convert 'admin' -> 'Administrator', etc.
      const rawRole = data.roles?.[0] ?? 'Administrator';
      const role = normalizeRole(rawRole);
      
      const newUser: UserInfo = {
        name: data.name ?? 'Admin',
        email: data.email ?? 'admin@demo.cl',
        role,
      };
      
      setUser(newUser);
      setCachedUser(newUser);
    } else {
      // Redirect to login if no token
      window.location.href = '/login';
      return;
    }
    setLoading(false);
  }, []);

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
      loading,
    };
  }, [user, loading]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used inside <RoleProvider>');
  return ctx;
}
