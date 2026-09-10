import { Schema } from 'mongoose';
import { ACTIVITY_ACTIONS, IActivityLog } from '../types/activity-log';

export const activityLogSchema = new Schema<IActivityLog>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  entityType: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId, required: true },
action: {
    type: String,
    enum: ACTIVITY_ACTIONS,
    required: true,
  },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  changes: {
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
  },
  metadata: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
});

// Indexes
activityLogSchema.index({ tenantId: 1, entityType: 1, entityId: 1 });
activityLogSchema.index({ tenantId: 1, timestamp: -1 });
activityLogSchema.index({ tenantId: 1, actorId: 1, timestamp: -1 });
