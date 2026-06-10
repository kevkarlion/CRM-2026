import { Schema } from 'mongoose';
import { IPlatformUser } from '../types/platform-user';

export const platformUserSchema = new Schema<IPlatformUser>(
  {
    email: { type: String, required: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    role: {
      type: String,
      enum: ['super_admin', 'developer', 'support'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
    lastLoginAt: { type: Date },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes
platformUserSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
