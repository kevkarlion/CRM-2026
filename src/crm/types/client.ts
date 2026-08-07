import { Document, Types } from 'mongoose';
import { IAuditFields } from './audit-fields';

export type CustomerType = 'residential' | 'commercial' | 'industrial';
export type ClientStatus = 'prospect' | 'active' | 'inactive' | 'blacklisted';

export interface IClient extends Document, IAuditFields {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  customerType: CustomerType;
  status: ClientStatus;
  fullName?: string;
  companyName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  locality?: string;
  province?: string;
  notes?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type CreateClientInput = Omit<
  IClient,
  keyof Document | '_id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedBy' | 'deletedAt'
>;

export type UpdateClientInput = Partial<Omit<CreateClientInput, 'tenantId'>>;
