import { Schema } from 'mongoose';
import { ITimelineEvent } from '../types/timeline-event';

export const timelineEventSchema = new Schema<ITimelineEvent>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    eventType: { type: String, required: true },
    title: { type: String, required: true },
    description: String,
    summary: String,
    icon: String,
    color: String,
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

timelineEventSchema.index({ tenantId: 1, leadId: 1, createdAt: -1 });
timelineEventSchema.index({ tenantId: 1, entityType: 1, entityId: 1 });
