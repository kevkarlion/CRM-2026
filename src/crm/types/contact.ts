import { Document, Types } from 'mongoose';
import { IAuditFields } from './audit-fields';

export interface IContact extends Document, IAuditFields {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  clientId: Types.ObjectId;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role?: string;
  isPrimary: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateContactInput = Omit<
  IContact,
  keyof Document | '_id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedBy' | 'deletedAt'
>;

export type UpdateContactInput = Partial<Omit<CreateContactInput, 'tenantId' | 'clientId'>>;
