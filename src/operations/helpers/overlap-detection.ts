import { Types } from 'mongoose';
import { WorkOrderModel } from '../models';
import { IWorkOrder } from '../types/work-order';

export interface TimeSlot {
  scheduledDate: Date;
  scheduledStart: Date;
  scheduledEnd: Date;
}

export async function checkTechnicianConflict(
  tenantId: Types.ObjectId,
  technicianId: Types.ObjectId,
  slot: TimeSlot,
  excludeWorkOrderId?: Types.ObjectId,
): Promise<IWorkOrder | null> {
  const filter: Record<string, unknown> = {
    tenantId,
    assignedTechnicians: technicianId,
    scheduledDate: slot.scheduledDate,
    scheduledStart: { $lt: slot.scheduledEnd },
    scheduledEnd: { $gt: slot.scheduledStart },
    deletedAt: null,
    status: { $nin: ['cancelled', 'closed'] },
  };

  if (excludeWorkOrderId) {
    filter._id = { $ne: excludeWorkOrderId };
  }

  return WorkOrderModel.findOne(filter) as unknown as Promise<IWorkOrder | null>;
}

export async function checkMultiTechnicianConflicts(
  tenantId: Types.ObjectId,
  technicianIds: Types.ObjectId[],
  slot: TimeSlot,
  excludeWorkOrderId?: Types.ObjectId,
): Promise<Array<{ technicianId: Types.ObjectId; conflict: IWorkOrder }>> {
  const results = await Promise.all(
    technicianIds.map(async (techId) => {
      const conflict = await checkTechnicianConflict(tenantId, techId, slot, excludeWorkOrderId);
      return conflict ? { technicianId: techId, conflict } : null;
    }),
  );

  return results.filter(Boolean) as Array<{ technicianId: Types.ObjectId; conflict: IWorkOrder }>;
}

export async function hasNoConflicts(
  tenantId: Types.ObjectId,
  technicianIds: Types.ObjectId[],
  slot: TimeSlot,
  excludeWorkOrderId?: Types.ObjectId,
): Promise<boolean> {
  const conflicts = await checkMultiTechnicianConflicts(tenantId, technicianIds, slot, excludeWorkOrderId);
  return conflicts.length === 0;
}
