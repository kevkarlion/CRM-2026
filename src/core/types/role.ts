import { Document, Types } from 'mongoose';

export interface IRole extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  description?: string;
  isSystem: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
