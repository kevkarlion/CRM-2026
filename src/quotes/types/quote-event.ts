import { Document, Types } from 'mongoose';

export type QuoteEventType = 'created' | 'sent' | 'approved' | 'rejected' | 'expired' | 'cancelled' | 'status_changed';

export interface IQuoteEvent extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  quoteId: Types.ObjectId;
  eventType: QuoteEventType;
  description: string;
  performedBy: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
