import { Schema } from 'mongoose';
import { IMaintenancePlan, FrequencyUnit } from '../types/maintenance-plan';

const frequencyUnits: FrequencyUnit[] = ['monthly', 'quarterly', 'biannual', 'annual', 'days'];

export const maintenancePlanSchema = new Schema<IMaintenancePlan>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
    name: { type: String, required: true, trim: true },
    interval: { type: Number, required: true, min: 1 },
    unit: {
      type: String,
      enum: frequencyUnits,
      required: true,
    },
    description: { type: String, trim: true },
    checklistTemplate: [{ type: String }],
    active: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
  },
  { timestamps: true }
);

maintenancePlanSchema.index({ tenantId: 1, contractId: 1, active: 1 });
maintenancePlanSchema.index({ tenantId: 1, deletedAt: 1 });
