import { Types } from 'mongoose';
import ActivityLogModel from '../core/models/activity-log';
import { ActivityAction } from '../core/types/activity-log';

export interface ActivityLogInput {
  tenantId: string | Types.ObjectId;
  entityType: string;
  entityId: string | Types.ObjectId;
  action: ActivityAction;
  actorId: string | Types.ObjectId;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Logs a business entity mutation to the ActivityLog.
 *
 * ActivityLog is APPEND-ONLY — entries are never modified or deleted.
 *
 * Use for: entity creation, updates, deletion, assignment, status changes.
 *
 * @example
 *   await logActivity({
 *     tenantId: '...',
 *     entityType: 'lead',
 *     entityId: lead._id,
 *     action: 'created',
 *     actorId: user._id,
 *   });
 */
export async function logActivity(input: ActivityLogInput): Promise<void> {
  try {
    await ActivityLogModel.create({
      tenantId: input.tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorId: input.actorId,
      changes: input.changes || undefined,
      metadata: input.metadata || undefined,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[ActivityLogger] Failed to persist activity:', error);
  }
}

/**
 * Retrieves the activity history for a specific entity.
 */
export async function getEntityHistory(
  tenantId: string | Types.ObjectId,
  entityType: string,
  entityId: string | Types.ObjectId,
  options?: { limit?: number }
) {
  return ActivityLogModel.find({
    tenantId,
    entityType,
    entityId,
  })
    .sort({ timestamp: -1 })
    .limit(options?.limit || 50)
    .lean()
    .exec();
}

/**
 * Retrieves recent activity for a tenant (activity feed).
 */
export async function getTenantActivityFeed(
  tenantId: string | Types.ObjectId,
  options?: { limit?: number; entityType?: string }
) {
  const filter: Record<string, unknown> = { tenantId };

  if (options?.entityType) {
    filter.entityType = options.entityType;
  }

  return ActivityLogModel.find(filter)
    .sort({ timestamp: -1 })
    .limit(options?.limit || 20)
    .lean()
    .exec();
}
