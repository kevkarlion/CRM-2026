import { Document, Types } from 'mongoose';

export type WorkOrderEventType = 'created' | 'assigned' | 'status_changed' | 'checklist_completed' | 'technician_changed' | 'visit_started' | 'visit_completed' | 'attachment_uploaded' | 'note_added' | 'closed' | 'rescheduled';

export interface IWorkOrderEvent extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  workOrderId: Types.ObjectId;
  eventType: WorkOrderEventType;
  description: string;
  performedBy: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export type CreateWorkOrderEventInput = Omit<
  IWorkOrderEvent,
  keyof Document | '_id' | 'createdAt'
>;
