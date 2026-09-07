import { Schema } from 'mongoose';
import { normalizePhone } from '@/lib/phone';
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
contactSchema.index(
  { tenantId: 1, phone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null,
      phone: { $exists: true, $ne: null },
    },
  }
);

contactSchema.pre('save', function (next) {
  if (this.phone) {
    this.phone = normalizePhone(this.phone);
  }
  next();
});

contactSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() as {
    phone?: unknown;
    $set?: { phone?: unknown };
    $setOnInsert?: { phone?: unknown };
  } | null;
  if (update && update.phone) {
    update.phone = normalizePhone(String(update.phone));
  }
  if (update && update.$set && update.$set.phone) {
    update.$set.phone = normalizePhone(String(update.$set.phone));
  }
  if (update && update.$setOnInsert && update.$setOnInsert.phone) {
    update.$setOnInsert.phone = normalizePhone(String(update.$setOnInsert.phone));
  }
  next();
});
