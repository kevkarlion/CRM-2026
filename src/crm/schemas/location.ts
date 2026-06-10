import { Schema } from 'mongoose';
import { ILocation } from '../types/location';

const auditFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
};

export const locationSchema = new Schema<ILocation>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    name: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    province: { type: String, required: true },
    country: { type: String, required: true },
    postalCode: String,
    latitude: Number,
    longitude: Number,
    notes: String,
    ...auditFields,
  },
  { timestamps: true }
);

// Indexes
locationSchema.index({ tenantId: 1, clientId: 1 });
