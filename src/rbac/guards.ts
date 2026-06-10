import { PermissionKey } from './permissions';

export interface UserPermission {
  roleId: string;
  permissions: PermissionKey[];
}

/**
 * Checks whether a user has a specific permission through any of their roles.
 *
 * @param rolePermissions - Array of the user's roles with their associated permissions
 * @param requiredPermission - The permission key to check
 * @returns true if any role grants the required permission
 */
export function hasPermission(
  rolePermissions: UserPermission[],
  requiredPermission: PermissionKey
): boolean {
  return rolePermissions.some((rp) =>
    rp.permissions.includes(requiredPermission)
  );
}

/**
 * Checks whether a user has ALL of the specified permissions.
 *
 * @param rolePermissions - Array of the user's roles with their associated permissions
 * @param requiredPermissions - List of permission keys that must ALL be present
 * @returns true if all required permissions are granted
 */
export function hasAllPermissions(
  rolePermissions: UserPermission[],
  requiredPermissions: PermissionKey[]
): boolean {
  return requiredPermissions.every((perm) =>
    hasPermission(rolePermissions, perm)
  );
}

/**
 * Checks whether a user has ANY of the specified permissions.
 *
 * @param rolePermissions - Array of the user's roles with their associated permissions
 * @param requiredPermissions - List of permission keys where at least one must be present
 * @returns true if at least one required permission is granted
 */
export function hasAnyPermission(
  rolePermissions: UserPermission[],
  requiredPermissions: PermissionKey[]
): boolean {
  return requiredPermissions.some((perm) =>
    hasPermission(rolePermissions, perm)
  );
}

/**
 * Returns the union of all permissions from the user's roles.
 *
 * @param rolePermissions - Array of the user's roles with their associated permissions
 * @returns Deduplicated array of all granted permission keys
 */
export function getAllPermissions(
  rolePermissions: UserPermission[]
): PermissionKey[] {
  const all = rolePermissions.flatMap((rp) => rp.permissions);
  return [...new Set(all)];
}

/**
 * Middleware-style guard result.
 */
export interface GuardResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Asserts that a user has a specific permission.
 * Returns a GuardResult object instead of throwing.
 */
export function requirePermission(
  rolePermissions: UserPermission[],
  requiredPermission: PermissionKey
): GuardResult {
  if (hasPermission(rolePermissions, requiredPermission)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Missing required permission: ${requiredPermission}`,
  };
}
