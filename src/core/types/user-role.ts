import { Document, Types } from 'mongoose';

export interface IUserRole extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  roleId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
