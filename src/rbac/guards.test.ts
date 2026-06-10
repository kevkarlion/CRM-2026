import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getAllPermissions,
  requirePermission,
  UserPermission,
} from './guards';
import { Permissions } from './permissions';

const makeRole = (permissions: string[]): UserPermission => ({
  roleId: 'role-1',
  permissions: permissions as any,
});

describe('hasPermission', () => {
  const userRoles = [
    makeRole([Permissions.CLIENTS_READ, Permissions.CLIENTS_EDIT]),
    makeRole([Permissions.WORKORDERS_READ]),
  ];

  it('returns true when any role grants the permission', () => {
    expect(hasPermission(userRoles, Permissions.CLIENTS_READ)).toBe(true);
    expect(hasPermission(userRoles, Permissions.WORKORDERS_READ)).toBe(true);
  });

  it('returns false when no role grants the permission', () => {
    expect(hasPermission(userRoles, Permissions.QUOTES_APPROVE)).toBe(false);
  });

  it('returns false for empty roles array', () => {
    expect(hasPermission([], Permissions.CLIENTS_READ)).toBe(false);
  });
});

describe('hasAllPermissions', () => {
  const userRoles = [
    makeRole([Permissions.CLIENTS_READ, Permissions.CLIENTS_EDIT, Permissions.CLIENTS_CREATE]),
  ];

  it('returns true when all permissions are present', () => {
    expect(
      hasAllPermissions(userRoles, [Permissions.CLIENTS_READ, Permissions.CLIENTS_EDIT])
    ).toBe(true);
  });

  it('returns false when any permission is missing', () => {
    expect(
      hasAllPermissions(userRoles, [Permissions.CLIENTS_READ, Permissions.CLIENTS_DELETE])
    ).toBe(false);
  });
});

describe('hasAnyPermission', () => {
  const userRoles = [makeRole([Permissions.LEADS_CREATE])];

  it('returns true when at least one permission matches', () => {
    expect(
      hasAnyPermission(userRoles, [Permissions.QUOTES_APPROVE, Permissions.LEADS_CREATE])
    ).toBe(true);
  });

  it('returns false when no permissions match', () => {
    expect(
      hasAnyPermission(userRoles, [Permissions.QUOTES_APPROVE, Permissions.WORKORDERS_ASSIGN])
    ).toBe(false);
  });
});

describe('getAllPermissions', () => {
  it('returns deduplicated union of all role permissions', () => {
    const roles = [
      makeRole([Permissions.CLIENTS_READ, Permissions.CLIENTS_EDIT]),
      makeRole([Permissions.CLIENTS_READ, Permissions.CLIENTS_DELETE]),
    ];

    const result = getAllPermissions(roles);

    expect(result).toContain(Permissions.CLIENTS_READ);
    expect(result).toContain(Permissions.CLIENTS_EDIT);
    expect(result).toContain(Permissions.CLIENTS_DELETE);
    expect(result.length).toBe(3);
  });
});

describe('requirePermission', () => {
  const userRoles = [makeRole([Permissions.WORKORDERS_CREATE])];

  it('returns allowed: true when permission is granted', () => {
    const result = requirePermission(userRoles, Permissions.WORKORDERS_CREATE);
    expect(result.allowed).toBe(true);
  });

  it('returns allowed: false with reason when permission is denied', () => {
    const result = requirePermission(userRoles, Permissions.WORKORDERS_ASSIGN);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Missing required permission');
  });
});
