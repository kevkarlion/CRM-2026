// ── Role verification helpers for API routes ─────────────

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { Permissions, type PermissionKey, type TenantRoleName } from '@/rbac/permissions';

const ASSIGNABLE_ROLES: TenantRoleName[] = ['Owner', 'Administrator', 'Supervisor', 'Dispatcher'];

const ROLE_PERMISSIONS: Record<TenantRoleName, PermissionKey[]> = {
  Owner: Object.values(Permissions),
  Administrator: [
    Permissions.WORKORDERS_CREATE,
    Permissions.WORKORDERS_READ,
    Permissions.WORKORDERS_EDIT,
    Permissions.WORKORDERS_DELETE,
    Permissions.WORKORDERS_ASSIGN,
    Permissions.WORKORDERS_STATUS_CHANGE,
  ],
  Supervisor: [
    Permissions.WORKORDERS_CREATE,
    Permissions.WORKORDERS_READ,
    Permissions.WORKORDERS_EDIT,
    Permissions.WORKORDERS_ASSIGN,
    Permissions.WORKORDERS_STATUS_CHANGE,
  ],
  Dispatcher: [
    Permissions.WORKORDERS_CREATE,
    Permissions.WORKORDERS_READ,
    Permissions.WORKORDERS_EDIT,
    Permissions.WORKORDERS_ASSIGN,
    Permissions.WORKORDERS_STATUS_CHANGE,
  ],
  Technician: [
    Permissions.WORKORDERS_READ,
    Permissions.WORKORDERS_EDIT,
    Permissions.WORKORDERS_STATUS_CHANGE,
  ],
  Sales: [],
  Accounting: [],
};

export async function getUserRole(request: NextRequest): Promise<TenantRoleName | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET || 'development-secret-key';
  
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const roles = payload.roles as string[] | undefined;
    if (!roles || roles.length === 0) {
      return null;
    }
    
    // Map role names
    const roleMap: Record<string, TenantRoleName> = {
      'admin': 'Administrator',
      'owner': 'Owner',
      'superadmin': 'Owner',
      'supervisor': 'Supervisor',
      'dispatcher': 'Dispatcher',
      'technician': 'Technician',
      'tech': 'Technician',
      'sales': 'Sales',
      'commercial': 'Sales',
      'accounting': 'Accounting',
    };
    
    const normalizedRole = roleMap[roles[0].toLowerCase()];
    return normalizedRole || null;
  } catch {
    return null;
  }
}

export async function requireAssignPermission(request: NextRequest): Promise<{ error?: string; status?: number }> {
  const role = await getUserRole(request);
  
  if (!role) {
    return { error: 'No se pudo verificar el rol del usuario', status: 401 };
  }

  if (!ASSIGNABLE_ROLES.includes(role)) {
    return { 
      error: 'No tienes permiso para asignar técnicos. Solo administradores, supervisores y dispatchers pueden asignar.', 
      status: 403 
    };
  }

  return {};
}

export function canAssignTechnician(role: TenantRoleName | null): boolean {
  if (!role) return false;
  return ASSIGNABLE_ROLES.includes(role);
}