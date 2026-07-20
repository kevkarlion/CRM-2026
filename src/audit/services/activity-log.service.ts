import { Types } from 'mongoose';
import ActivityLogModel from '@/core/models/activity-log';
import { IActivityLog } from '@/core/types/activity-log';

export interface CreateActivityLogInput {
  tenantId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
}

export class ActivityLogService {
  async create(data: CreateActivityLogInput): Promise<void> {
    try {
      await ActivityLogModel.create({
        tenantId: new Types.ObjectId(data.tenantId),
        entityType: data.entityType,
        entityId: new Types.ObjectId(data.entityId),
        action: data.action,
        actorId: new Types.ObjectId(data.actorId),
        changes: data.changes,
        metadata: data.metadata,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('[ActivityLogService] Failed to create activity log:', error);
    }
  }
}

export const activityLogService = new ActivityLogService();
