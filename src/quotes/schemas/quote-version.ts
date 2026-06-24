import { Schema } from 'mongoose';
import { IQuoteVersion, QuoteItemType } from '../types/quote-version';

const quoteItemSchema = new Schema(
  {
    description: { type: String, required: true, maxlength: 500 },
    type: {
      type: String,
      enum: ['product', 'service', 'labor', 'material', 'part'] satisfies QuoteItemType[],
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

export const quoteVersionSchema = new Schema<IQuoteVersion>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    quoteId: { type: Schema.Types.ObjectId, ref: 'Quote', required: true },
    version: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    items: { type: [quoteItemSchema], required: true, default: [] },
    subtotal: { type: Number, required: true, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, default: 0, min: 0 },
    notes: { type: String, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

quoteVersionSchema.index({ tenantId: 1, quoteId: 1, version: -1 });
quoteVersionSchema.index({ tenantId: 1, quoteId: 1 });
