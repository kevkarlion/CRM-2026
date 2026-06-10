import { Schema } from 'mongoose';
import { IRolePermission } from '../types/role-permission';

export const rolePermissionSchema = new Schema<IRolePermission>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    permissionId: { type: Schema.Types.ObjectId, ref: 'Permission', required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes
rolePermissionSchema.index({ tenantId: 1, roleId: 1, permissionId: 1 }, { unique: true });
