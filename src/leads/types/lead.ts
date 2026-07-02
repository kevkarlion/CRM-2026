import { Document, Types } from 'mongoose';

export type LeadStatus = 'new' | 'contacted' | 'quote_sent' | 'technical_visit' | 'qualified' | 'won' | 'lost' | 'disqualified';
export type LeadSource = 'whatsapp' | 'call' | 'form' | 'referral' | 'walk_in' | 'other';
export type QualificationStatus = 'qualified' | 'not_qualified' | 'pending';
export type LostReason = 'price' | 'competitor' | 'budget' | 'not_interested' | 'timing' | 'no_response' | 'other';

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
  qualificationStatus?: QualificationStatus;
  convertedToClient?: Types.ObjectId;
  convertedAt?: Date;
  lostReason?: LostReason;
  lostDescription?: string;
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
  status?: LeadStatus;
  lostReason?: LostReason;
  lostDescription?: string;
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
