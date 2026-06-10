import { Document, Types } from 'mongoose';

export interface IPermission extends Document {
  _id: Types.ObjectId;
  key: string;
  group: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
