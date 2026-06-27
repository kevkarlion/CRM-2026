import { Types } from 'mongoose';
import SecurityLogModel from '../core/models/security-log';
import { SecurityEventType } from '../core/types/security-log';

export interface SecurityLogInput {
  tenantId?: string | Types.ObjectId;
  eventType: SecurityEventType;
  userId?: string | Types.ObjectId;
  ipAddress: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Logs a security event to the SecurityLog.
 *
 * SecurityLog is APPEND-ONLY — entries are never modified or deleted.
 *
 * Events: LOGIN_SUCCESS, LOGIN_FAILED, PASSWORD_CHANGED,
 *         ROLE_CHANGED, USER_LOCKED, ACCESS_RESTORED
 */
export async function logSecurityEvent(
  input: SecurityLogInput
): Promise<void> {
  try {
    await SecurityLogModel.create({
      tenantId: input.tenantId || undefined,
      eventType: input.eventType,
      userId: input.userId || undefined,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: input.metadata || undefined,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[SecurityLogger] Failed to persist security event:', error);
  }
}

/**
 * Retrieves security events for a tenant.
 */
export async function getTenantSecurityLog(
  tenantId: string | Types.ObjectId,
  options?: {
    eventType?: SecurityEventType;
    limit?: number;
    from?: Date;
    to?: Date;
  }
) {
  const filter: Record<string, unknown> = { tenantId };

  if (options?.eventType) {
    filter.eventType = options.eventType;
  }

  if (options?.from || options?.to) {
    const timestampFilter: Record<string, unknown> = {};
    if (options.from) timestampFilter.$gte = options.from;
    if (options.to) timestampFilter.$lte = options.to;
    filter.timestamp = timestampFilter;
  }

  return SecurityLogModel.find(filter)
    .sort({ timestamp: -1 })
    .limit(options?.limit || 50)
    
    .exec();
}

/**
 * Retrieves security events for a specific user.
 */
export async function getUserSecurityLog(
  userId: string | Types.ObjectId,
  options?: { limit?: number }
) {
  return SecurityLogModel.find({ userId })
    .sort({ timestamp: -1 })
    .limit(options?.limit || 20)
    
    .exec();
}

/**
 * Retrieves failed login attempts for a user within a time window.
 * Useful for lockout detection.
 */
export async function getFailedLoginAttempts(
  userId: string | Types.ObjectId,
  withinMinutes = 15
): Promise<number> {
  const since = new Date(Date.now() - withinMinutes * 60 * 1000);

  const count = await SecurityLogModel.countDocuments({
    userId,
    eventType: 'LOGIN_FAILED',
    timestamp: { $gte: since },
  });

  return count;
}
