import { Schema } from 'mongoose';
import { ITenant } from '../types/tenant';

export const tenantSchema = new Schema<ITenant>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'suspended', 'disabled'],
      default: 'active',
    },
    plan: {
      type: {
        type: String,
        enum: ['starter', 'professional', 'enterprise'],
        required: true,
      },
      features: { type: Schema.Types.Mixed, default: {} },
    },
    locale: {
      country: { type: String, required: true },
      currency: { type: String, required: true },
      timezone: { type: String, required: true },
      language: { type: String, required: true },
    },
    quoteNumberPrefix: { type: String, default: 'COT', trim: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes
tenantSchema.index({ status: 1, createdAt: 1 });
