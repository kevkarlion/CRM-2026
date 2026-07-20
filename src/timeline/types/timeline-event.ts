import { Types, Document } from 'mongoose';

export interface ITimelineEvent extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  leadId: Types.ObjectId;
  entityType: string;
  entityId: Types.ObjectId;
  eventType: string;
  title: string;
  description?: string;
  summary?: string;
  icon?: string;
  color?: string;
  performedBy: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export type CreateTimelineEventInput = {
  tenantId: string;
  leadId: string;
  entityType: string;
  entityId: string;
  eventType: string;
  title: string;
  description?: string;
  summary?: string;
  icon?: string;
  color?: string;
  performedBy: string;
  metadata?: Record<string, unknown>;
};
