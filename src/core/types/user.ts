import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  status: 'active' | 'invited' | 'suspended' | 'disabled';
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  failedLoginAttempts: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
