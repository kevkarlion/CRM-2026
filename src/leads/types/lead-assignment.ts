import { Document, Types } from 'mongoose';

export interface ILeadAssignment extends Document {
  tenantId: Types.ObjectId;
  leadId: Types.ObjectId;
  userId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  unassignedAt: Date | null;
  reason?: string;
}

export interface CreateLeadAssignmentInput {
  tenantId: Types.ObjectId;
  leadId: Types.ObjectId;
  userId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  reason?: string;
}
