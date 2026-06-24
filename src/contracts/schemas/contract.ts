import { Schema } from 'mongoose';
import { IContract, ContractStatus } from '../types/contract';

const contractStatuses: ContractStatus[] = ['draft', 'active', 'paused', 'expired', 'cancelled'];

export const contractSchema = new Schema<IContract>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    status: {
      type: String,
      enum: contractStatuses,
      required: true,
      default: 'draft',
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    frequency: {
      interval: { type: Number, required: true, min: 1 },
      unit: {
        type: String,
        enum: ['days', 'months', 'years'],
        required: true,
      },
    },
    clientSnapshot: {
      name: { type: String, required: true },
      email: { type: String },
      phone: { type: String },
    },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
  },
  { timestamps: true }
);

contractSchema.index({ tenantId: 1, clientId: 1, status: 1 });
contractSchema.index({ tenantId: 1, status: 1, endDate: 1 });
contractSchema.index({ tenantId: 1, deletedAt: 1 });
