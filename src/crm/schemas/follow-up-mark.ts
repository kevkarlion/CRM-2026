import { Schema } from 'mongoose';
import { IFollowUpMark } from '../types/follow-up-mark';

export const followUpMarkSchema = new Schema<IFollowUpMark>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
    assignedTo: { type: String, required: true },
    markedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    markedAt: { type: Date, required: true, default: Date.now },
    note: { type: String },
  },
  { timestamps: true }
);

// Indexes
followUpMarkSchema.index({ tenantId: 1, leadId: 1 });
followUpMarkSchema.index({ tenantId: 1, clientId: 1 });
followUpMarkSchema.index({ tenantId: 1, assignedTo: 1 });
