import { Document, Types } from 'mongoose';

export type QuoteItemType = 'product' | 'service' | 'labor' | 'material' | 'part';

export interface IQuoteItem {
  description: string;
  type: QuoteItemType;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface IQuoteVersion extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  quoteId: Types.ObjectId;
  version: number;
  title: string;
  description?: string;
  items: IQuoteItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

export interface CreateQuoteVersionInput {
  quoteId: string;
  version: number;
  title: string;
  description?: string;
  items: CreateQuoteItemInput[];
  discountAmount?: number;
  taxAmount?: number;
  notes?: string;
  createdBy: string;
}

export interface CreateQuoteItemInput {
  description: string;
  type: QuoteItemType;
  quantity: number;
  unitPrice: number;
}
