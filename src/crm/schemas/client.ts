import { Schema } from 'mongoose';
import { IClient } from '../types/client';

const auditFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
};

export const clientSchema = new Schema<IClient>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    customerType: {
      type: String,
      enum: ['residential', 'commercial', 'industrial'],
      required: true,
    },
    status: {
      type: String,
      enum: ['prospect', 'active', 'inactive', 'blacklisted'],
      default: 'prospect',
    },
    fullName: String,
    companyName: String,
    taxId: String,
    email: String,
    phone: String,
    notes: String,
    tags: { type: [String], default: [] },
    ...auditFields,
  },
  { timestamps: true }
);

// Indexes
clientSchema.index({ tenantId: 1, status: 1, createdAt: 1 });
clientSchema.index(
  { tenantId: 1, taxId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null,
      taxId: { $exists: true, $ne: null },
    },
  }
);
clientSchema.index({ tenantId: 1, tags: 1 });
