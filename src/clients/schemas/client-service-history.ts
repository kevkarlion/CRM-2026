import { Schema } from 'mongoose';
import type { IClientServiceHistory } from '../types/client-service-history';

export const clientServiceHistorySchema = new Schema<IClientServiceHistory>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    serviceType: {
      type: String,
      enum: ['repair', 'maintenance', 'installation', 'budget', 'other'],
      required: true,
    },
    address: { type: String, required: true },
    locality: { type: String, required: true },
    province: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      required: true,
      default: 'pending',
    },
    createdBy: { type: String, required: true, default: 'whatsapp-bot' },
  },
  { timestamps: true }
);

// Indexes
clientServiceHistorySchema.index({ tenantId: 1, clientId: 1, createdAt: -1 });
clientServiceHistorySchema.index({ tenantId: 1, status: 1 });