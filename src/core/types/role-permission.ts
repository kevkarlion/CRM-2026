import { Document, Types } from 'mongoose';

export interface IRolePermission extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  roleId: Types.ObjectId;
  permissionId: Types.ObjectId;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
