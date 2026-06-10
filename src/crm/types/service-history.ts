import { Document, Types } from 'mongoose';
import { IAuditFields } from './audit-fields';

export interface IServiceHistory extends Document, IAuditFields {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  equipmentId: Types.ObjectId;
  performedBy: Types.ObjectId;
  serviceDate: Date;
  serviceType: 'installation' | 'maintenance' | 'repair' | 'diagnosis';
  description?: string;
  observations?: string;
  attachments: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export type CreateServiceHistoryInput = Omit<
  IServiceHistory,
  keyof Document | '_id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedBy' | 'deletedAt'
>;

export type UpdateServiceHistoryInput = Partial<
  Omit<CreateServiceHistoryInput, 'tenantId' | 'equipmentId'>
>;
