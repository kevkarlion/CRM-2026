import { Schema } from 'mongoose';
import { IQuote, QuoteStatus } from '../types/quote';

export const quoteSchema = new Schema<IQuote>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', default: null },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', default: null },
    number: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'sent', 'approved', 'rejected', 'expired', 'cancelled', 'direct_sale'] satisfies QuoteStatus[],
      required: true,
      default: 'draft',
    },
    currentVersion: { type: Number, required: true, default: 1, min: 1 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    validUntil: { type: Date, default: null },
    subtotal: { type: Number, required: true, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, default: 0, min: 0 },
    notes: { type: String, maxlength: 2000 },
    sentAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    rejectedReason: { type: String, maxlength: 500 },
    convertedToWorkOrder: { type: Schema.Types.ObjectId, ref: 'WorkOrder', default: null },
    convertedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

quoteSchema.index({ tenantId: 1, number: 1 }, { unique: true });
quoteSchema.index({ tenantId: 1, leadId: 1 });
quoteSchema.index({ tenantId: 1, clientId: 1 });
quoteSchema.index({ tenantId: 1, status: 1 });
quoteSchema.index({ tenantId: 1, deletedAt: 1 });
quoteSchema.index({ tenantId: 1, convertedToWorkOrder: 1 }, { sparse: true });
quoteSchema.index({ tenantId: 1, createdAt: -1 });
quoteSchema.index({ tenantId: 1, createdBy: 1, status: 1 });
quoteSchema.index({ tenantId: 1, validUntil: 1, status: 1 });
