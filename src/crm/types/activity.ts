import { Document, Types } from 'mongoose';

export const EVENT_TYPES = {
  LEAD_CREATED: 'lead.created',
  LEAD_STATUS_CHANGED: 'lead.status_changed',
  LEAD_CONVERTED: 'lead.converted',
  QUOTE_CREATED: 'quote.created',
  QUOTE_SENT: 'quote.sent',
  QUOTE_APPROVED: 'quote.approved',
  QUOTE_REJECTED: 'quote.rejected',
  VISIT_CREATED: 'visit.created',
  VISIT_STATUS_CHANGED: 'visit.status_changed',
  NEGOTIATION_CREATED: 'negotiation.created',
  NEGOTIATION_COUNTEROFFER: 'negotiation.counteroffer',
  NEGOTIATION_COUNTEROFFER_STATUS_CHANGED: 'negotiation.counteroffer_status_changed',
  NEGOTIATION_COMMERCIAL_EVENT: 'negotiation.commercial_event',
  NEGOTIATION_FOLLOWUP_UPDATED: 'negotiation.followup_updated',
  NEGOTIATION_CLOSED_WON: 'negotiation.closed_won',
  NEGOTIATION_CLOSED_LOST: 'negotiation.closed_lost',
  NEGOTIATION_STATUS_CHANGED: 'negotiation.status_changed',
  WORKORDER_CREATED: 'workorder.created',
  WORKORDER_STATUS_CHANGED: 'workorder.status_changed',
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

export interface IActivity extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  leadId?: Types.ObjectId;
  entityType: string;
  entityId: Types.ObjectId;
  activityType: 'note' | 'call' | 'email' | 'status_change' | 'follow_up';
  eventType?: string;
  title: string;
  description?: string;
  summary?: string;
  icon?: string;
  color?: string;
  performedBy: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export type CreateActivityInput = Omit<
  IActivity,
  keyof Document | '_id' | 'createdAt'
>;
