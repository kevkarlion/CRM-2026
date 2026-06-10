import { Document, Types } from 'mongoose';

export type PlatformRole = 'super_admin' | 'developer' | 'support';

export interface IPlatformUser extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: PlatformRole;
  status: 'active' | 'suspended';
  lastLoginAt?: Date;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
