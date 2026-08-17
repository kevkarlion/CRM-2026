import { Document, Types } from 'mongoose';

export type GestionStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
export type GestionSource = 'whatsapp' | 'call' | 'form' | 'referral' | 'walk_in' | 'other';
export type QualificationStatus = 'qualified' | 'not_qualified' | 'pending';
export type LostReason = 'price' | 'competitor' | 'budget' | 'not_interested' | 'timing' | 'no_response' | 'other';
export type InquiryReason = 'repair' | 'maintenance' | 'installation' | 'budget' | 'other' | 'spare_parts';
export type CustomerType = 'residential' | 'commercial';
export type Temperature = 'hot' | 'warm' | 'cold';

export interface ScoringBreakdown {
  buttons: number;
  property: number;
  keywords: number;
  b2b: number;
}

export interface IGestion extends Document {
  tenantId: Types.ObjectId;
  clientId: Types.ObjectId; // NEW: Reference to Client (not in Lead)
  originalLeadId?: Types.ObjectId; // Link to original lead for conversation tracking
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source: GestionSource;
  status: GestionStatus;
  assignedTo?: Types.ObjectId;
  previousGestionId?: Types.ObjectId;
  estimatedValue?: number;
  notes?: string;
  qualificationStatus?: QualificationStatus;
  lostReason?: LostReason;
  lostDescription?: string;
  inquiryReason?: string; // Changed from InquiryReason to allow free text
  customerType?: CustomerType;
  temperature?: Temperature;
  profileName?: string;
  address?: string;
  locality?: string;
  province?: string;
  priority?: 'high' | 'medium' | 'low';
  adminNotes?: string;
  score?: number;
  isB2B?: boolean;
  scoringBreakdown?: ScoringBreakdown;
  createdBy: string;
  updatedBy: string;
  deletedAt: Date | null;
  deletedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGestionInput {
  clientId: string;
  originalLeadId?: string; // Link to original lead for conversation tracking
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source?: GestionSource;
  assignedTo?: string;
  previousGestionId?: string;
  estimatedValue?: number;
  notes?: string;
  status?: GestionStatus;
  lostReason?: LostReason;
  lostDescription?: string;
  inquiryReason?: string; // Allow free text for lead conversion notes
  customerType?: CustomerType;
  temperature?: Temperature;
  score?: number;
  isB2B?: boolean;
  scoringBreakdown?: ScoringBreakdown;
  address?: string;
  locality?: string;
  province?: string;
}

export interface UpdateGestionInput {
  name?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source?: GestionSource;
  assignedTo?: string;
  estimatedValue?: number;
  notes?: string;
  adminNotes?: string;
  address?: string;
  locality?: string;
  province?: string;
}