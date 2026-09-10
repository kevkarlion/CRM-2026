import { Document, Types } from 'mongoose';

export type ActivityAction =
  | 'created' | 'updated' | 'deleted' | 'read'
  | 'assigned' | 'unassigned'
  | 'status_changed' | 'rejected' | 'converted' | 'version_created'
  | 'approved' | 'sent' | 'blocked' | 'unblocked'
  | 'activated' | 'paused' | 'cancelled' | 'expired'
  | 'equipment_added' | 'equipment_removed' | 'work_order_generated'
  | 'status.change' | 'statusChanged'
  | 'rescheduled'
  | 'technician.assigned' | 'technician.reassigned' | 'technician.unassigned'
  | 'checklist.created' | 'checklist.completed' | 'report.created'
  | 'work_started' | 'work_completed' | 'work_report_created'
  | 'workStatus_changed'
  | 'visit_started' | 'visit_completed';

/** All actions accepted at write time by the ActivityLog schema enum. */
export const ACTIVITY_ACTIONS: ActivityAction[] = [
  'created', 'updated', 'deleted', 'read',
  'assigned', 'unassigned',
  'status_changed', 'rejected', 'converted', 'version_created',
  'approved', 'sent', 'blocked', 'unblocked',
  'activated', 'paused', 'cancelled', 'expired',
  'equipment_added', 'equipment_removed', 'work_order_generated',
  'status.change', 'statusChanged',
  'rescheduled',
  'technician.assigned', 'technician.reassigned', 'technician.unassigned',
  'checklist.created', 'checklist.completed', 'report.created',
  'work_started', 'work_completed', 'work_report_created',
  'workStatus_changed',
  'visit_started', 'visit_completed',
];

export interface IActivityLog extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  entityType: string;
  entityId: Types.ObjectId;
  action: ActivityAction;
  actorId: Types.ObjectId;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
  timestamp: Date;
}
