import { Document, Types } from 'mongoose';

export type ServiceType = 'repair' | 'maintenance' | 'installation' | 'budget' | 'other';
export type ServiceStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface IClientServiceHistory extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  clientId: Types.ObjectId;
  serviceType: ServiceType;
  address: string;
  locality: string;
  province: string;
  description?: string;
  status: ServiceStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateClientServiceHistoryInput = Omit<
  IClientServiceHistory,
  keyof Document | '_id' | 'createdAt' | 'updatedAt'
>;