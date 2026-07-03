import { Document, Types } from 'mongoose';

export interface IServiceType extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateServiceTypeInput {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateServiceTypeInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}
