import mongoose, { Model } from 'mongoose';
import { IRolePermission } from '../types/role-permission';
import { rolePermissionSchema } from '../schemas/role-permission';

const RolePermissionModel: Model<IRolePermission> =
  mongoose.models.RolePermission || mongoose.model<IRolePermission>(
  'RolePermission',
  rolePermissionSchema
);

export default RolePermissionModel;
