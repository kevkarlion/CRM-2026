import { Schema } from 'mongoose';
import { INegotiationEvent } from '../types/negotiation-event';

export const negotiationEventSchema = new Schema<INegotiationEvent>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    negotiationId: { type: Schema.Types.ObjectId, ref: 'Negotiation', required: true },
    eventType: {
      type: String,
      enum: [
        'created', 'status_changed', 'counteroffer_made', 'counteroffer_responded',
        'discount_requested', 'discount_applied', 'follow_up_scheduled',
        'follow_up_completed', 'note_added', 'attachment_uploaded',
        'lead_assigned', 'lead_reassigned', 'closed', 'reopened',
      ],
      required: true,
    },
    description: { type: String, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

negotiationEventSchema.index({ tenantId: 1, negotiationId: 1, createdAt: -1 });
negotiationEventSchema.index({ tenantId: 1, eventType: 1, createdAt: -1 });
