import { Document, Types } from 'mongoose';

export type NegotiationEventType =
  | 'created'
  | 'status_changed'
  | 'counteroffer_made'
  | 'counteroffer_responded'
  | 'discount_requested'
  | 'discount_applied'
  | 'follow_up_scheduled'
  | 'follow_up_completed'
  | 'note_added'
  | 'attachment_uploaded'
  | 'lead_assigned'
  | 'lead_reassigned'
  | 'closed'
  | 'reopened';

export interface INegotiationEvent extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  negotiationId: Types.ObjectId;
  eventType: NegotiationEventType;
  description: string;
  performedBy: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export type CreateNegotiationEventInput = Omit<
  INegotiationEvent,
  keyof Document | '_id' | 'createdAt'
>;
