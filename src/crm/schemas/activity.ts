import { Schema } from 'mongoose';
import { IActivity } from '../types/activity';

export const activitySchema = new Schema<IActivity>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    activityType: {
      type: String,
      enum: ['note', 'call', 'email', 'status_change', 'follow_up'],
      required: true,
    },
    title: { type: String, required: true },
    description: String,
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Indexes
activitySchema.index({ tenantId: 1, entityType: 1, entityId: 1, createdAt: -1 });
activitySchema.index({ tenantId: 1, activityType: 1, createdAt: -1 });
