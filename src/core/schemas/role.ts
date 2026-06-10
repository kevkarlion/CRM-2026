import { Schema } from 'mongoose';
import { IRole } from '../types/role';

export const roleSchema = new Schema<IRole>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true },
    description: { type: String },
    isSystem: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes
roleSchema.index({ tenantId: 1, name: 1 }, { unique: true });
