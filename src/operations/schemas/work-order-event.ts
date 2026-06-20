import { Schema } from 'mongoose';
import { IWorkOrderEvent } from '../types/work-order-event';

export const workOrderEventSchema = new Schema<IWorkOrderEvent>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
    eventType: {
      type: String,
      enum: ['created', 'assigned', 'status_changed', 'checklist_completed', 'technician_changed', 'visit_started', 'visit_completed', 'attachment_uploaded', 'note_added', 'closed', 'rescheduled'],
      required: true,
    },
    description: { type: String, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

workOrderEventSchema.index({ tenantId: 1, workOrderId: 1, createdAt: -1 });
workOrderEventSchema.index({ tenantId: 1, eventType: 1, createdAt: -1 });
