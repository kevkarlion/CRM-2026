import { Schema } from 'mongoose';
import { ILeadAssignment } from '../types/lead-assignment';

export const leadAssignmentSchema = new Schema<ILeadAssignment>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedAt: { type: Date, default: Date.now },
    unassignedAt: { type: Date, default: null },
    reason: { type: String },
  },
  { timestamps: true }
);

leadAssignmentSchema.index({ tenantId: 1, leadId: 1, assignedAt: -1 });
