import { Document, Types } from 'mongoose';
import { CreateQuoteItemInput } from './quote-version';

export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export interface IQuote extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  leadId: Types.ObjectId | null;
  clientId: Types.ObjectId | null;
  locationId: Types.ObjectId | null;
  number: string;
  status: QuoteStatus;
  currentVersion: number;
  title: string;
  description?: string;
  validUntil: Date | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  notes?: string;
  sentAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectedReason: string | null;
  convertedToWorkOrder: Types.ObjectId | null;
  convertedAt: Date | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  deletedBy: Types.ObjectId | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateQuoteInput {
  leadId?: string;
  clientId?: string;
  locationId?: string;
  validUntil?: string;
  title: string;
  description?: string;
  items: CreateQuoteItemInput[];
  discountAmount?: number;
  taxAmount?: number;
  notes?: string;
}

export interface UpdateQuoteInput {
  title?: string;
  description?: string;
  items?: CreateQuoteItemInput[];
  discountAmount?: number;
  taxAmount?: number;
  validUntil?: string;
  notes?: string;
  locationId?: string;
}
