import { Types } from 'mongoose';
import { PlatformRole } from '../core/types/platform-user';
import PlatformUserModel from '../core/models/platform-user';

export interface AdminSession {
  userId: string | Types.ObjectId;
  email: string;
  role: PlatformRole;
}

/**
 * Verifies that a platform user exists and has an active session.
 *
 * Platform users (Super Admin, Developer, Support) operate outside
 * the tenant scope and have cross-tenant access.
 */
export async function verifyPlatformUser(
  userId: string | Types.ObjectId
): Promise<AdminSession | null> {
  try {
    const user = await PlatformUserModel.findById(userId)
      .select('email role status deletedAt')
      
      .exec();

    if (!user || user.status !== 'active' || user.deletedAt) {
      return null;
    }

    return {
      userId: user._id,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    console.error('[AdminGuard] Failed to verify platform user:', error);
    return null;
  }
}

/**
 * Checks if a platform user has a minimum required role level.
 *
 * Hierarchy: super_admin > developer > support
 */
export function hasMinimumRole(
  userRole: PlatformRole,
  minimumRole: PlatformRole
): boolean {
  const hierarchy: Record<PlatformRole, number> = {
    support: 1,
    developer: 2,
    super_admin: 3,
  };

  return hierarchy[userRole] >= hierarchy[minimumRole];
}

/**
 * Checks if a platform user is a Super Admin.
 */
export function isSuperAdmin(role: PlatformRole): boolean {
  return role === 'super_admin';
}

/**
 * Checks if a platform user is a Developer or above.
 */
export function isDeveloperOrAbove(role: PlatformRole): boolean {
  return hasMinimumRole(role, 'developer');
}

/**
 * Guard result for platform access control.
 */
export interface AdminGuardResult {
  allowed: boolean;
  reason?: string;
  session?: AdminSession;
}

/**
 * Authorizes a platform user by ID and minimum role requirement.
 */
export async function authorizePlatformAction(
  userId: string | Types.ObjectId,
  minimumRole: PlatformRole = 'support'
): Promise<AdminGuardResult> {
  const session = await verifyPlatformUser(userId);

  if (!session) {
    return {
      allowed: false,
      reason: 'Platform user not found, inactive, or deleted',
    };
  }

  if (!hasMinimumRole(session.role, minimumRole)) {
    return {
      allowed: false,
      reason: `Insufficient role. Required: ${minimumRole}, actual: ${session.role}`,
    };
  }

  return { allowed: true, session };
}
