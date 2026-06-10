import { Schema } from 'mongoose';
import { IContact } from '../types/contact';

const auditFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
};

export const contactSchema = new Schema<IContact>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: String,
    phone: String,
    role: String,
    isPrimary: { type: Boolean, default: false },
    notes: String,
    ...auditFields,
  },
  { timestamps: true }
);

// Indexes
contactSchema.index({ tenantId: 1, clientId: 1 });
contactSchema.index(
  { tenantId: 1, clientId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null,
      email: { $exists: true, $ne: null },
    },
  }
);
