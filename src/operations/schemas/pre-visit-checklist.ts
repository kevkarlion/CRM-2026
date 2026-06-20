import { Schema } from 'mongoose';
import { IPreVisitChecklist } from '../types/pre-visit-checklist';

export const preVisitChecklistSchema = new Schema<IPreVisitChecklist>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
    workOrderReviewed: { type: Boolean, default: false },
    toolsPrepared: { type: Boolean, default: false },
    partsAvailable: { type: Boolean, default: false },
    routeConfirmed: { type: Boolean, default: false },
    vehicleAssigned: { type: Boolean, default: false },
    safetyEquipmentChecked: { type: Boolean, default: false },
    notes: String,
    completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

preVisitChecklistSchema.index({ tenantId: 1, workOrderId: 1 }, { unique: true });
