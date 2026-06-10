import { Schema } from 'mongoose';
import { ITask } from '../types/task';

const auditFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
};

export const taskSchema = new Schema<ITask>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    entityType: String,
    entityId: { type: Schema.Types.ObjectId },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    dueDate: Date,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    completedAt: Date,
    ...auditFields,
  },
  { timestamps: true }
);

// Indexes
taskSchema.index({ tenantId: 1, assignedTo: 1, status: 1 });
taskSchema.index({ tenantId: 1, entityType: 1, entityId: 1 });
taskSchema.index({ tenantId: 1, status: 1, dueDate: 1 });
