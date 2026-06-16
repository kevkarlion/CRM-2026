import { Document, Types } from 'mongoose';

export type AssignmentStatus = 'assigned' | 'acknowledged' | 'declined' | 'replaced';

export interface IWorkOrderAssignment extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  workOrderId: Types.ObjectId;
  technicianId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  status: AssignmentStatus;
  acknowledgedAt?: Date;
  declinedAt?: Date;
  replacedAt?: Date;
  replacedByAssignmentId?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateWorkOrderAssignmentInput = Omit<
  IWorkOrderAssignment,
  keyof Document | '_id' | 'createdAt' | 'updatedAt' | 'status' | 'acknowledgedAt' | 'declinedAt' | 'replacedAt' | 'replacedByAssignmentId'
>;
