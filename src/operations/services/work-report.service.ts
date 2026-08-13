import { Types } from 'mongoose';
import { WorkReportModel } from '../models';
import {
  IWorkReport,
  CreateWorkReportInput,
  CreateWorkReportApiInput,
  UpdateWorkReportInput,
} from '../types/work-report';

export class WorkReportService {
  /**
   * Create a new WorkReport for a WorkOrder
   */
  async createForWorkOrder(
    workOrderId: string,
    data: CreateWorkReportApiInput,
    tenantId: string,
    userId: string,
  ): Promise<IWorkReport> {
    const report = await WorkReportModel.create({
      ...data,
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(workOrderId),
      technicalVisitId: data.technicalVisitId
        ? new Types.ObjectId(data.technicalVisitId)
        : undefined,
      technicianId: new Types.ObjectId(data.technicianId),
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    return report.toObject();
  }

  /**
   * Create a new WorkReport for a TechnicalVisit
   */
  async createForTechnicalVisit(
    technicalVisitId: string,
    data: CreateWorkReportApiInput,
    tenantId: string,
    userId: string,
  ): Promise<IWorkReport> {
    const report = await WorkReportModel.create({
      ...data,
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: data.workOrderId
        ? new Types.ObjectId(data.workOrderId)
        : undefined,
      technicalVisitId: new Types.ObjectId(technicalVisitId),
      technicianId: new Types.ObjectId(data.technicianId),
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    return report.toObject();
  }

  /**
   * Get WorkReport by WorkOrder ID
   */
  async getByWorkOrderId(
    workOrderId: string,
    tenantId: string,
  ): Promise<IWorkReport | null> {
    return WorkReportModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(workOrderId),
      deletedAt: null,
    }).exec();
  }

  /**
   * Get WorkReport by TechnicalVisit ID
   */
  async getByTechnicalVisitId(
    technicalVisitId: string,
    tenantId: string,
  ): Promise<IWorkReport | null> {
    return WorkReportModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      technicalVisitId: new Types.ObjectId(technicalVisitId),
      deletedAt: null,
    }).exec();
  }

  /**
   * Get WorkReport by ID
   */
  async getById(
    workReportId: string,
    tenantId: string,
  ): Promise<IWorkReport | null> {
    return WorkReportModel.findOne({
      _id: new Types.ObjectId(workReportId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    }).exec();
  }

  /**
   * Update WorkReport
   */
  async update(
    workReportId: string,
    data: UpdateWorkReportInput & { version: number },
    tenantId: string,
    userId: string,
  ): Promise<IWorkReport | null> {
    const { version, ...fields } = data;

    const updated = await WorkReportModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(workReportId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
        version,
      },
      {
        $set: {
          ...fields,
          updatedBy: new Types.ObjectId(userId),
        },
        $inc: { version: 1 },
      },
      { new: true },
    ).exec();

    if (!updated) {
      throw new Error('Version conflict: WorkReport was modified by another user.');
    }

    return updated;
  }

  /**
   * Validate WorkReport input
   */
  validateWorkReportInput(
    data: CreateWorkReportApiInput,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Result is required
    if (!data.result) {
      errors.push('Result is required');
    }

    // Validate startedAt and finishedAt
    if (!data.startedAt) {
      errors.push('startedAt is required');
    }

    if (!data.finishedAt) {
      errors.push('finishedAt is required');
    }

    if (data.startedAt && data.finishedAt && data.finishedAt < data.startedAt) {
      errors.push('finishedAt must be greater than or equal to startedAt');
    }

    // Validate workPerformed if provided
    if (data.workPerformed && data.workPerformed.length > 10) {
      errors.push('Maximum 10 work items can be selected');
    }

    // Validate text fields length
    if (data.observationsText && data.observationsText.length > 1500) {
      errors.push('Las observaciones no pueden exceder 1500 caracteres');
    }

    if (data.additionalIssuesText && data.additionalIssuesText.length > 1500) {
      errors.push('La descripción del problema no puede exceder 1500 caracteres');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if WorkReport exists for WorkOrder
   */
  async existsForWorkOrder(
    workOrderId: string,
    tenantId: string,
  ): Promise<boolean> {
    const count = await WorkReportModel.countDocuments({
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(workOrderId),
      deletedAt: null,
    });
    return count > 0;
  }

  /**
   * Check if WorkReport exists for TechnicalVisit
   */
  async existsForTechnicalVisit(
    technicalVisitId: string,
    tenantId: string,
  ): Promise<boolean> {
    const count = await WorkReportModel.countDocuments({
      tenantId: new Types.ObjectId(tenantId),
      technicalVisitId: new Types.ObjectId(technicalVisitId),
      deletedAt: null,
    });
    return count > 0;
  }

  /**
   * Delete WorkReport (soft delete)
   */
  async delete(
    workReportId: string,
    tenantId: string,
    userId: string,
  ): Promise<boolean> {
    const result = await WorkReportModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(workReportId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      },
      {
        $set: {
          deletedBy: new Types.ObjectId(userId),
          deletedAt: new Date(),
        },
      },
    ).exec();

    return !!result;
  }
}

export const workReportService = new WorkReportService();