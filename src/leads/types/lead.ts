import { Document, Types } from 'mongoose';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'won' | 'lost' | 'disqualified';
export type LeadSource = 'whatsapp' | 'call' | 'form' | 'referral' | 'walk_in' | 'other';

export interface ILead extends Document {
  tenantId: Types.ObjectId;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source: LeadSource;
  status: LeadStatus;
  assignedTo?: Types.ObjectId;
  previousLeadId?: Types.ObjectId;
  estimatedValue?: number;
  notes?: string;
  convertedToClient?: Types.ObjectId;
  convertedAt?: Date;
  createdBy: string;
  updatedBy: string;
  deletedAt: Date | null;
  deletedBy: string | null;
}

export interface CreateLeadInput {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source: LeadSource;
  assignedTo?: string;
  previousLeadId?: string;
  estimatedValue?: number;
  notes?: string;
}

export interface UpdateLeadInput {
  name?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source?: LeadSource;
  assignedTo?: string;
  estimatedValue?: number;
  notes?: string;
}
