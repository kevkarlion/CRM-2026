import { Document, Types } from 'mongoose';

export type NegotiationStatus = 'open' | 'counteroffer_made' | 'accepted' | 'rejected' | 'expired';

export const NEGOTIATION_STATUSES: NegotiationStatus[] = [
  'open',
  'counteroffer_made',
  'accepted',
  'rejected',
  'expired',
];

export type CounterOfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

export interface CounterOffer {
  amount: number;
  discountFixed?: number;
  discountPercent?: number;
  terms: string;
  reason?: string;
  internalNotes?: string;
  createdBy: Types.ObjectId;
  validUntil: Date;
  status: CounterOfferStatus;
  respondedAt?: Date;
  createdAt: Date;
}

export type CommercialEventType =
  | 'discount_request'
  | 'financing_request'
  | 'scope_change'
  | 'needs_time'
  | 'technical_query'
  | 'new_visit_request'
  | 'accepted_conditions'
  | 'rejected_conditions'
  | 'other';

export interface CommercialEvent {
  eventType: CommercialEventType;
  description: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

export type FollowUpPriority = 'low' | 'medium' | 'high';

export interface FollowUp {
  nextContactDate?: Date;
  assignedTo?: Types.ObjectId;
  priority: FollowUpPriority;
  internalNotes?: string;
  updatedAt: Date;
  updatedBy: Types.ObjectId;
}

export interface INegotiation extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  leadId: Types.ObjectId;
  quoteId?: Types.ObjectId;
  status: NegotiationStatus;
  counterOffers: CounterOffer[];
  commercialEvents: CommercialEvent[];
  followUp?: FollowUp;
  discountAmount?: number;
  validUntil?: Date;
  terms?: string;
  isDeleted: boolean;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}
