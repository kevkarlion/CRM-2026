import { Schema } from 'mongoose';
import { IUserRole } from '../types/user-role';

export const userRoleSchema = new Schema<IUserRole>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes
userRoleSchema.index({ tenantId: 1, userId: 1 });
userRoleSchema.index({ tenantId: 1, roleId: 1 });
