import { Schema } from 'mongoose';
import { IServiceType } from '../types/service-type';

export const serviceTypeSchema = new Schema<IServiceType>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);

serviceTypeSchema.index({ tenantId: 1, name: 1 }, { unique: true });
serviceTypeSchema.index({ tenantId: 1, isActive: 1 });
