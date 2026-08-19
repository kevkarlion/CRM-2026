import { Schema } from 'mongoose';
import { normalizePhone } from '@/lib/phone';
import { IClient, ClientStatus } from '../types/client';

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
      default: 'residential',
    },
    status: {
      type: String,
      enum: ['prospect', 'active', 'inactive', 'blocked'] satisfies ClientStatus[],
      default: 'active',
    },
    fullName: String,
    companyName: String,
    taxId: String,
    email: String,
    phone: String,
    address: String,
    locality: String,
    province: String,
    source: {
      type: String,
      enum: ['whatsapp', 'call', 'form', 'referral', 'walk_in', 'other'],
    },
    notes: String,
    tags: { type: [String], default: [] },
    blockHistory: [
      {
        reason: { type: String, required: true },
        blockedAt: { type: Date, required: true },
        blockedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        unblockedAt: { type: Date, default: null },
        unblockedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      },
    ],
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

clientSchema.pre('save', function (next) {
  if (this.phone) {
    this.phone = normalizePhone(this.phone);
  }
  next();
});

clientSchema.pre('findOneAndUpdate', function (next) {
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
