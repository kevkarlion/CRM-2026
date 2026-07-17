import mongoose, { Model, Schema } from 'mongoose';
import { ITechnicalVisit } from '../schemas/technical-visit';

const technicalVisitSchema = new Schema<ITechnicalVisit>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', default: null },
    clientSnapshot: {
      name: { type: String, required: true },
      email: String,
      phone: String,
    },
    locationSnapshot: {
      name: String,
      address: String,
      city: String,
      province: String,
    },
    visitNumber: { type: String, required: true },
    title: { type: String, required: true },
    description: String,
    scheduledDate: Date,
    scheduledStart: Date,
    scheduledEnd: Date,
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'converted_to_work_order'],
      default: 'draft',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    category: {
      type: String,
      enum: ['inspection', 'budget', 'assessment', 'emergency', 'other'],
      default: 'budget',
    },
    result: {
      findings: String,
      recommendation: String,
      estimatedBudget: Number,
      nextSteps: String,
    },
    convertedToWorkOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', default: null },
    convertedAt: { type: Date, default: null },
    assignedTechnicianId: { type: Schema.Types.ObjectId, ref: 'Technician', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Indexes
technicalVisitSchema.index({ tenantId: 1, status: 1 });
technicalVisitSchema.index({ tenantId: 1, visitNumber: 1 }, { unique: true });
technicalVisitSchema.index({ tenantId: 1, leadId: 1 });
technicalVisitSchema.index({ tenantId: 1, scheduledDate: 1 });

export const TechnicalVisitModel: Model<ITechnicalVisit> =
  mongoose.models.TechnicalVisit || mongoose.model<ITechnicalVisit>('TechnicalVisit', technicalVisitSchema);