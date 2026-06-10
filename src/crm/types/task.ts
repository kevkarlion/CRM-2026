import { Document, Types } from 'mongoose';
import { IAuditFields } from './audit-fields';

export interface ITask extends Document, IAuditFields {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  entityType?: string;
  entityId?: Types.ObjectId;
  assignedTo: Types.ObjectId;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateTaskInput = Omit<
  ITask,
  keyof Document | '_id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedBy' | 'deletedAt'
>;

export type UpdateTaskInput = Partial<
  Omit<CreateTaskInput, 'tenantId' | 'assignedTo'>
>;
