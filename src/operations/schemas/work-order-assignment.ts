import { Schema } from 'mongoose';
import { IWorkOrderAssignment } from '../types/work-order-assignment';

export const workOrderAssignmentSchema = new Schema<IWorkOrderAssignment>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
    technicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['assigned', 'acknowledged', 'declined', 'replaced'],
      required: true,
      default: 'assigned',
    },
    acknowledgedAt: Date,
    declinedAt: Date,
    replacedAt: Date,
    replacedByAssignmentId: { type: Schema.Types.ObjectId, ref: 'WorkOrderAssignment' },
    notes: String,
  },
  { timestamps: true }
);

workOrderAssignmentSchema.index({ tenantId: 1, workOrderId: 1, technicianId: 1 }, { unique: true });
workOrderAssignmentSchema.index({ tenantId: 1, technicianId: 1, status: 1 });
workOrderAssignmentSchema.index({ tenantId: 1, workOrderId: 1, status: 1 });
