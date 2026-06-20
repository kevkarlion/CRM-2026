import { Schema } from 'mongoose';
import { IVisitReport } from '../types/visit-report';

const auditFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
};

export const visitReportSchema = new Schema<IVisitReport>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
    technicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    arrivalTime: { type: Date, required: true },
    departureTime: { type: Date, required: true },
    workPerformed: { type: String, required: true },
    observations: String,
    recommendations: String,
    version: { type: Number, default: 0 },
    customerSignature: String,
    customerName: String,
    signedAt: Date,
    ...auditFields,
  },
  { timestamps: true }
);

visitReportSchema.index({ tenantId: 1, workOrderId: 1 }, { unique: true });
visitReportSchema.index({ tenantId: 1, technicianId: 1, createdAt: -1 });
