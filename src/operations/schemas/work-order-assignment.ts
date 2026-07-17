import { Schema } from 'mongoose';
import { IWorkOrderAssignment, AssignmentType, AssignmentReason } from '../types/work-order-assignment';

export const workOrderAssignmentSchema = new Schema<IWorkOrderAssignment>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
    technicianId: { type: Schema.Types.ObjectId, ref: 'Technician', required: true },
    
    // Auditoría completa
    previousTechnicianId: { type: Schema.Types.ObjectId, ref: 'Technician', default: null },
    assignmentType: {
      type: String,
      enum: ['initial', 'auto_assignment', 'manual', 'redistribution', 'replacement'],
      required: true,
      default: 'manual',
    },
    reason: {
      type: String,
      enum: ['customer_request', 'proximity', 'availability', 'coverage', 'specialty', 'priority', 'replacement', 'schedule_change', 'performance', 'other'],
      required: true,
      default: 'other',
    },
    reasonDetail: { type: String, default: null },
    
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

// Indexes for replacement chain and audit queries
workOrderAssignmentSchema.index({ tenantId: 1, workOrderId: 1, createdAt: -1 });
workOrderAssignmentSchema.index({ tenantId: 1, technicianId: 1, status: 1 });
workOrderAssignmentSchema.index({ tenantId: 1, workOrderId: 1, status: 1 });
workOrderAssignmentSchema.index({ tenantId: 1, assignmentType: 1 });
workOrderAssignmentSchema.index({ tenantId: 1, reason: 1 });
workOrderAssignmentSchema.index({ workOrderId: 1, technicianId: 1 }, { unique: true, sparse: true });
