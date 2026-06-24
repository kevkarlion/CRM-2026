import { Document, Types } from 'mongoose';

export interface ITenant extends Document {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  status: 'active' | 'suspended' | 'disabled';
  plan: {
    type: 'starter' | 'professional' | 'enterprise';
    features: Record<string, boolean>;
  };
  locale: {
    country: string;
    currency: string;
    timezone: string;
    language: string;
  };
  quoteNumberPrefix: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
