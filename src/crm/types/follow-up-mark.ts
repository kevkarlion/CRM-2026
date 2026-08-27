import { Document, Types } from 'mongoose';

export interface IFollowUpMark extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  leadId?: Types.ObjectId;
  clientId?: Types.ObjectId;
  assignedTo: string; // User email
  markedBy: Types.ObjectId;
  markedAt: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
  // Added by service when returning for user
  targetType?: 'lead' | 'client';
  targetId?: string;
  target?: {
    _id: string;
    name: string;
    status?: string;
    [key: string]: unknown;
  };
  markedByUser?: {
    _id: string;
    name: string;
    email: string;
  };
}

// Input type accepts strings (will be converted to ObjectId in service)
export type CreateFollowUpMarkInput = {
  leadId?: string;
  clientId?: string;
  assignedTo: string;
  note?: string;
};

export type UpdateFollowUpMarkInput = Partial<
  Omit<CreateFollowUpMarkInput, 'tenantId'>
>;
