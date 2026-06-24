import { Document, Types } from 'mongoose';

export type ContractStatus = 'draft' | 'active' | 'paused' | 'expired' | 'cancelled';

export interface ContractFrequency {
  interval: number;
  unit: 'days' | 'months' | 'years';
}

export interface IContract extends Document {
  tenantId: Types.ObjectId;
  clientId: Types.ObjectId;
  status: ContractStatus;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  frequency: ContractFrequency;
  clientSnapshot: {
    name: string;
    email?: string;
    phone?: string;
  };
  createdBy: string;
  updatedBy: string;
  deletedAt: Date | null;
  deletedBy: string | null;
}

export interface CreateContractInput {
  clientId: Types.ObjectId;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  frequency: ContractFrequency;
}

export interface UpdateContractInput {
  name?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  frequency?: ContractFrequency;
}
