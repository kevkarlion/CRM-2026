import { Document, Types } from 'mongoose';

export interface IActivity extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  entityType: string;
  entityId: Types.ObjectId;
  activityType: 'note' | 'call' | 'email' | 'status_change' | 'follow_up';
  title: string;
  description?: string;
  performedBy: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export type CreateActivityInput = Omit<
  IActivity,
  keyof Document | '_id' | 'createdAt'
>;
