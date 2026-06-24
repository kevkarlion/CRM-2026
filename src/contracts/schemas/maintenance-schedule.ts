import { Schema } from 'mongoose';
import { IMaintenanceSchedule, ScheduleStatus } from '../types/maintenance-schedule';

const scheduleStatuses: ScheduleStatus[] = ['scheduled', 'completed', 'cancelled', 'skipped'];

export const maintenanceScheduleSchema = new Schema<IMaintenanceSchedule>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
    maintenancePlanId: { type: Schema.Types.ObjectId, ref: 'MaintenancePlan', required: true },
    equipmentIds: [{ type: Schema.Types.ObjectId, ref: 'Equipment' }],
    scheduledDate: { type: Date, required: true },
    status: {
      type: String,
      enum: scheduleStatuses,
      required: true,
      default: 'scheduled',
    },
    workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

maintenanceScheduleSchema.index({ tenantId: 1, contractId: 1, scheduledDate: 1, status: 1 });
maintenanceScheduleSchema.index({ tenantId: 1, scheduledDate: 1, status: 1, workOrderId: 1 });
