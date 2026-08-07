import { Document, Types } from 'mongoose';
import { IAuditFields } from './audit-fields';
import type { LeadSource } from '@/leads/types/lead';

export type CustomerType = 'residential' | 'commercial' | 'industrial';
export type ClientStatus = 'prospect' | 'active' | 'inactive' | 'blocked';

export interface BlockHistoryEntry {
  reason: string;
  blockedAt: Date;
  blockedBy: Types.ObjectId | null;
  unblockedAt?: Date | null;
  unblockedBy?: Types.ObjectId | null;
}

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
  source?: LeadSource;
  notes?: string;
  tags: string[];
  blockHistory?: BlockHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export type CreateClientInput = Omit<
  IClient,
  | keyof Document
  | '_id'
  | 'createdAt'
  | 'updatedAt'
  | 'createdBy'
  | 'updatedBy'
  | 'deletedBy'
  | 'deletedAt'
  | 'status'
  | 'blockHistory'
>;

export type UpdateClientInput = Partial<Omit<CreateClientInput, 'tenantId'>>;
