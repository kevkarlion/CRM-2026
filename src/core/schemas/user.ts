import { Schema, Types } from 'mongoose';
import { IUser } from '../types/user';

export const userSchema = new Schema<IUser>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    email: { type: String, required: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'invited', 'suspended', 'disabled'],
      default: 'invited',
    },
    lastLoginAt: { type: Date },
    passwordChangedAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes
userSchema.index({ tenantId: 1, email: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
userSchema.index({ tenantId: 1, status: 1 });
userSchema.index({ tenantId: 1, deletedAt: 1 });
