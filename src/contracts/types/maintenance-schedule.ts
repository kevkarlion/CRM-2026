import { Document, Types } from 'mongoose';

export type ScheduleStatus = 'scheduled' | 'completed' | 'cancelled' | 'skipped';

export interface IMaintenanceSchedule extends Document {
  tenantId: Types.ObjectId;
  contractId: Types.ObjectId;
  maintenancePlanId: Types.ObjectId;
  equipmentIds: Types.ObjectId[];
  scheduledDate: Date;
  status: ScheduleStatus;
  workOrderId: Types.ObjectId | null;
  createdAt: Date;
}
