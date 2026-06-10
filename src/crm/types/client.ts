import { Document, Types } from 'mongoose';
import { IAuditFields } from './audit-fields';

export interface IClient extends Document, IAuditFields {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  customerType: 'residential' | 'commercial' | 'industrial';
  status: 'prospect' | 'active' | 'inactive' | 'blacklisted';
  fullName?: string;
  companyName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
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
