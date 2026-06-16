import { Types } from 'mongoose';
import { VisitReportModel } from '../models';
import { IVisitReport, CreateVisitReportInput, UpdateVisitReportInput } from '../types/visit-report';
import { logActivity } from '../../audit/activity-logger';

export class VisitReportService {
  async createVisitReport(
    workOrderId: string,
    data: CreateVisitReportInput,
    tenantId: string,
    userId: string,
  ): Promise<IVisitReport> {
    const existing = await VisitReportModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(workOrderId),
      deletedAt: null,
    }).lean().exec();

    if (existing) {
      throw new Error('VisitReport already exists for this WorkOrder.');
    }

    const report = await VisitReportModel.create({
      ...data,
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(workOrderId),
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    await logActivity({
      tenantId,
      entityType: 'workOrder',
      entityId: workOrderId,
      action: 'report.created',
      actorId: userId,
    });

    return report.toObject();
  }

  async updateVisitReport(
    workOrderId: string,
    data: UpdateVisitReportInput,
    tenantId: string,
    userId: string,
  ): Promise<IVisitReport | null> {
    const updated = await VisitReportModel.findOneAndUpdate(
      {
        tenantId: new Types.ObjectId(tenantId),
        workOrderId: new Types.ObjectId(workOrderId),
        deletedAt: null,
      },
      { $set: { ...data, updatedBy: new Types.ObjectId(userId) } },
      { new: true },
    ).lean().exec();

    return updated;
  }

  async getVisitReport(
    workOrderId: string,
    tenantId: string,
  ): Promise<IVisitReport | null> {
    return VisitReportModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(workOrderId),
      deletedAt: null,
    }).lean().exec();
  }

  async existsForWorkOrder(
    workOrderId: string,
    tenantId: string,
  ): Promise<boolean> {
    const count = await VisitReportModel.countDocuments({
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(workOrderId),
      deletedAt: null,
    });
    return count > 0;
  }
}
