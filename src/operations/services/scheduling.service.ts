import { Types } from 'mongoose';
import { WorkOrderModel, WorkOrderEventModel } from '../models';
import { TimeSlot, checkMultiTechnicianConflicts, hasNoConflicts } from '../helpers/overlap-detection';
import { logActivity } from '../../audit/activity-logger';

export interface ConflictResult {
  technicianId: Types.ObjectId;
  conflict: Record<string, unknown>;
}

export class SchedulingService {
  async checkConflicts(
    tenantId: string,
    technicianId: string,
    startTime: Date,
    endTime: Date,
    excludeWorkOrderId?: string,
  ): Promise<boolean> {
    const slot: TimeSlot = {
      scheduledDate: new Date(startTime.toISOString().slice(0, 10)),
      scheduledStart: startTime,
      scheduledEnd: endTime,
    };

    const excludeId = excludeWorkOrderId ? new Types.ObjectId(excludeWorkOrderId) : undefined;

    return hasNoConflicts(
      new Types.ObjectId(tenantId),
      [new Types.ObjectId(technicianId)],
      slot,
      excludeId,
    );
  }

  async validateAvailability(
    tenantId: string,
    technicianIds: string[],
    startTime: Date,
    endTime: Date,
  ): Promise<{ available: boolean; conflicts: ConflictResult[] }> {
    const slot: TimeSlot = {
      scheduledDate: new Date(startTime.toISOString().slice(0, 10)),
      scheduledStart: startTime,
      scheduledEnd: endTime,
    };

    const conflicts = await checkMultiTechnicianConflicts(
      new Types.ObjectId(tenantId),
      technicianIds.map((id) => new Types.ObjectId(id)),
      slot,
    );

    if (conflicts.length === 0) {
      return { available: true, conflicts: [] };
    }

    return {
      available: false,
      conflicts: conflicts.map((c) => ({
        technicianId: c.technicianId,
        conflict: c.conflict as unknown as Record<string, unknown>,
      })),
    };
  }

  async schedule(
    workOrderId: string,
    scheduleData: {
      scheduledDate: Date;
      scheduledStart: Date;
      scheduledEnd: Date;
    },
    tenantId: string,
    userId: string,
    version: number,
  ): Promise<Record<string, unknown> | null> {
    const slot: TimeSlot = {
      scheduledDate: scheduleData.scheduledDate,
      scheduledStart: scheduleData.scheduledStart,
      scheduledEnd: scheduleData.scheduledEnd,
    };

    const current = await WorkOrderModel.findOne({
      _id: workOrderId, tenantId, deletedAt: null,
    }).select('assignedTechnicians status version').exec();

    if (!current) return null;

    const technicianIds = current.assignedTechnicians || [];
    const noConflicts = await hasNoConflicts(
      new Types.ObjectId(tenantId),
      technicianIds,
      slot,
    );

    if (!noConflicts) {
      throw new Error('Scheduling conflict detected for one or more technicians.');
    }

    const updated = await WorkOrderModel.findOneAndUpdate(
      { _id: workOrderId, tenantId, version },
      {
        $set: {
          scheduledDate: scheduleData.scheduledDate,
          scheduledStart: scheduleData.scheduledStart,
          scheduledEnd: scheduleData.scheduledEnd,
          updatedBy: userId,
        },
        $inc: { version: 1 },
      },
      { new: true },
    ).exec();

    if (!updated) {
      throw new Error('WorkOrder was modified by another user. Please refresh and retry.');
    }

    return updated as unknown as Record<string, unknown>;
  }

  async reschedule(
    workOrderId: string,
    newScheduleData: {
      scheduledDate: Date;
      scheduledStart: Date;
      scheduledEnd: Date;
    },
    tenantId: string,
    userId: string,
    version: number,
  ): Promise<Record<string, unknown> | null> {
    const current = await WorkOrderModel.findOne({
      _id: workOrderId, tenantId, deletedAt: null,
    }).exec();

    if (!current) return null;

    const before = {
      scheduledDate: current.scheduledDate,
      scheduledStart: current.scheduledStart,
      scheduledEnd: current.scheduledEnd,
    };

    const slot: TimeSlot = {
      scheduledDate: newScheduleData.scheduledDate,
      scheduledStart: newScheduleData.scheduledStart,
      scheduledEnd: newScheduleData.scheduledEnd,
    };

    const technicianIds = current.assignedTechnicians || [];
    const noConflicts = await hasNoConflicts(
      new Types.ObjectId(tenantId),
      technicianIds,
      slot,
      new Types.ObjectId(workOrderId),
    );

    if (!noConflicts) {
      throw new Error('Scheduling conflict detected for one or more technicians.');
    }

    const updated = await WorkOrderModel.findOneAndUpdate(
      { _id: workOrderId, tenantId, version },
      {
        $set: {
          scheduledDate: newScheduleData.scheduledDate,
          scheduledStart: newScheduleData.scheduledStart,
          scheduledEnd: newScheduleData.scheduledEnd,
          updatedBy: userId,
        },
        $inc: { version: 1 },
      },
      { new: true },
    ).exec();

    if (!updated) {
      throw new Error('WorkOrder was modified by another user. Please refresh and retry.');
    }

    await WorkOrderEventModel.create({
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(workOrderId),
      eventType: 'rescheduled',
      description: 'WorkOrder was rescheduled',
      performedBy: new Types.ObjectId(userId),
      metadata: {
        before,
        after: {
          scheduledDate: newScheduleData.scheduledDate,
          scheduledStart: newScheduleData.scheduledStart,
          scheduledEnd: newScheduleData.scheduledEnd,
        },
      },
    });

    await logActivity({
      tenantId,
      entityType: 'workOrder',
      entityId: workOrderId,
      action: 'rescheduled',
      actorId: userId,
      changes: {
        before: before as Record<string, unknown>,
        after: newScheduleData as unknown as Record<string, unknown>,
      },
    });

    return updated as unknown as Record<string, unknown>;
  }
}
