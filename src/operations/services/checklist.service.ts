import { Types } from 'mongoose';
import { PreVisitChecklistModel } from '../models';
import { IPreVisitChecklist } from '../types/pre-visit-checklist';
import { logActivity } from '../../audit/activity-logger';

const CHECKLIST_BOOLEANS = [
  'workOrderReviewed',
  'toolsPrepared',
  'partsAvailable',
  'routeConfirmed',
  'vehicleAssigned',
  'safetyEquipmentChecked',
] as const;

export class ChecklistService {
  async findByWorkOrder(
    workOrderId: string,
    tenantId: string,
  ): Promise<IPreVisitChecklist | null> {
    return PreVisitChecklistModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(workOrderId),
    }).exec();
  }

  async createChecklist(
    workOrderId: string,
    tenantId: string,
    userId: string,
  ): Promise<IPreVisitChecklist> {
    const existing = await PreVisitChecklistModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(workOrderId),
    }).exec();

    if (existing) {
      throw new Error('Checklist already exists for this WorkOrder.');
    }

    const checklist = await PreVisitChecklistModel.create({
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(workOrderId),
      workOrderReviewed: false,
      toolsPrepared: false,
      partsAvailable: false,
      routeConfirmed: false,
      vehicleAssigned: false,
      safetyEquipmentChecked: false,
    });

    await logActivity({
      tenantId,
      entityType: 'workOrder',
      entityId: workOrderId,
      action: 'checklist.created',
      actorId: userId,
    });

    return checklist.toObject();
  }

  async updateChecklist(
    workOrderId: string,
    data: Partial<Pick<IPreVisitChecklist, typeof CHECKLIST_BOOLEANS[number]>>,
    tenantId: string,
    userId: string,
  ): Promise<IPreVisitChecklist | null> {
    const updated = await PreVisitChecklistModel.findOneAndUpdate(
      { tenantId: new Types.ObjectId(tenantId), workOrderId: new Types.ObjectId(workOrderId) },
      { $set: { ...data, completedBy: new Types.ObjectId(userId) } },
      { new: true },
    ).exec();

    return updated;
  }

  async completeChecklist(
    workOrderId: string,
    tenantId: string,
    userId: string,
  ): Promise<IPreVisitChecklist | null> {
    const updated = await PreVisitChecklistModel.findOneAndUpdate(
      { tenantId: new Types.ObjectId(tenantId), workOrderId: new Types.ObjectId(workOrderId) },
      {
        $set: {
          workOrderReviewed: true,
          toolsPrepared: true,
          partsAvailable: true,
          routeConfirmed: true,
          vehicleAssigned: true,
          safetyEquipmentChecked: true,
          completedBy: new Types.ObjectId(userId),
          completedAt: new Date(),
        },
      },
      { new: true },
    ).exec();

    if (updated) {
      await logActivity({
        tenantId,
        entityType: 'workOrder',
        entityId: workOrderId,
        action: 'checklist.completed',
        actorId: userId,
      });
    }

    return updated;
  }

  async validateChecklist(
    workOrderId: string,
    tenantId: string,
  ): Promise<boolean> {
    const checklist = await PreVisitChecklistModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(workOrderId),
    }).exec();

    if (!checklist) return false;

    const allTrue = CHECKLIST_BOOLEANS.every((field) => checklist[field] === true);
    return allTrue && !!checklist.completedAt;
  }
}
