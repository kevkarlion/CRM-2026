import { Document, Types } from 'mongoose';
import { IAuditFields } from './audit-fields';
import type { LeadSource } from '@/leads/types/lead';

export type CustomerType = 'residential' | 'commercial' | 'industrial';
export type ClientStatus = 'prospect' | 'active' | 'inactive' | 'blocked';

/**
 * Estados internos de operación comercial del cliente
 * (independientes del pipeline de leads)
 */
export type ClientOperationStatus = 
  | 'none'                    // Sin operación activa
  | 'quote_pending'           // Presupuesto enviado
  | 'quote_approved'          // Presupuesto aprobado
  | 'visit_scheduled'          // Visita técnica programada
  | 'sale_confirmed';          // Venta confirmada

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
  profileName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  locality?: string;
  province?: string;
  source?: LeadSource;
  notes?: string;
  inheritNotes?: string; // Notas heredadas del lead (read-only, no editables)
  tags: string[];
  blockHistory?: BlockHistoryEntry[];
  operationStatus?: ClientOperationStatus;
  operationStatusUpdatedAt?: Date;
  score?: number;
  temperature?: 'hot' | 'warm' | 'cold';
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
