import { Types } from 'mongoose';
import WorkOrderAssignmentModel from '../models/work-order-assignment';
import { IWorkOrderAssignment } from '../models/work-order-assignment';
import WorkOrderModel from '../models/work-order';
import { TechnicianModel } from '../models/technician';
import { NotFoundError, ValidationError } from '@/core/errors';

export class WorkAssignmentService {
  /**
   * Create a new work order assignment with full audit trail
   */
  async createAssignment(
    workOrderId: string,
    technicianId: string,
    assignedBy: string,
    tenantId: string,
    options: {
      assignmentType: 'initial' | 'auto_assignment' | 'manual' | 'redistribution' | 'replacement';
      reason: string;
      reasonDetail?: string;
      notes?: string;
      previousTechnicianId?: string;
    }
  ): Promise<any> {
    // Verify work order exists
    const workOrder = await WorkOrderModel.findOne({
      _id: new Types.ObjectId(workOrderId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    });

    if (!workOrder) {
      throw new NotFoundError('Work order not found');
    }

    // Verify technician exists
    const technician = await TechnicianModel.findOne({
      _id: new Types.ObjectId(technicianId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    });

    if (!technician) {
      throw new NotFoundError('Technician not found');
    }

    // Check if there's already an active assignment
    const existingAssignment = await WorkOrderAssignmentModel.findOne({
      workOrderId: new Types.ObjectId(workOrderId),
      tenantId: new Types.ObjectId(tenantId),
      status: { $in: ['assigned', 'acknowledged'] },
      deletedAt: null,
    });

    // If replacing, mark old one as replaced
    if (existingAssignment && options.assignmentType === 'replacement') {
      await WorkOrderAssignmentModel.findByIdAndUpdate(existingAssignment._id, {
        $set: {
          status: 'replaced',
          replacedAt: new Date(),
          replacedByAssignmentId: null, // Will be set after creating new one
        },
      });
    }

    // Create the new assignment
    const assignment = await WorkOrderAssignmentModel.create({
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(workOrderId),
      technicianId: new Types.ObjectId(technicianId),
      previousTechnicianId: options.previousTechnicianId
        ? new Types.ObjectId(options.previousTechnicianId)
        : null,
      assignmentType: options.assignmentType,
      reason: options.reason as any,
      reasonDetail: options.reasonDetail,
      assignedBy: new Types.ObjectId(assignedBy),
      assignedAt: new Date(),
      status: 'assigned',
      notes: options.notes,
    });

    // Update the old assignment's replacedByAssignmentId
    if (existingAssignment && options.assignmentType === 'replacement') {
      await WorkOrderAssignmentModel.findByIdAndUpdate(existingAssignment._id, {
        $set: {
          replacedByAssignmentId: assignment._id,
        },
      });
    }

    // Update work order's assignedTechnicians
    const currentTechnicians = workOrder.assignedTechnicians || [];
    const newTechnicianId = new Types.ObjectId(technicianId);
    
    if (!currentTechnicians.some(t => t.equals(newTechnicianId))) {
      await WorkOrderModel.findByIdAndUpdate(workOrderId, {
        $push: { assignedTechnicians: newTechnicianId },
        $set: { status: 'assigned', updatedBy: new Types.ObjectId(assignedBy) },
      });
    }

    return assignment;
  }

  /**
   * Get assignment history for a work order
   */
  async getAssignmentHistory(
    workOrderId: string,
    tenantId: string
  ): Promise<any[]> {
    return WorkOrderAssignmentModel.find({
      workOrderId: new Types.ObjectId(workOrderId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .populate('technicianId', 'name email phone')
      .populate('previousTechnicianId', 'name email phone')
      .populate('assignedBy', 'firstName lastName email')
      .lean();
  }

  /**
   * Get current active assignment for a work order
   */
  async getCurrentAssignment(
    workOrderId: string,
    tenantId: string
  ): Promise<any | null> {
    return WorkOrderAssignmentModel.findOne({
      workOrderId: new Types.ObjectId(workOrderId),
      tenantId: new Types.ObjectId(tenantId),
      status: { $in: ['assigned', 'acknowledged'] },
      deletedAt: null,
    })
      .populate('technicianId', 'name email phone availability')
      .lean();
  }

  /**
   * Replace technician on a work order
   */
  async replaceTechnician(
    workOrderId: string,
    newTechnicianId: string,
    replacedBy: string,
    tenantId: string,
    reason: string,
    reasonDetail?: string,
    notes?: string
  ): Promise<any> {
    const currentAssignment = await this.getCurrentAssignment(workOrderId, tenantId);
    
    if (!currentAssignment) {
      throw new ValidationError('No active assignment to replace');
    }

    return this.createAssignment(workOrderId, newTechnicianId, replacedBy, tenantId, {
      assignmentType: 'replacement',
      reason,
      reasonDetail,
      notes,
      previousTechnicianId: String(currentAssignment.technicianId._id),
    });
  }

  /**
   * Get assignments by technician with filters
   */
  async getAssignmentsByTechnician(
    technicianId: string,
    tenantId: string,
    filters: {
      status?: string;
      dateFrom?: Date;
      dateFromLte?: Date;
    } = {}
  ): Promise<any[]> {
    const query: Record<string, unknown> = {
      technicianId: new Types.ObjectId(technicianId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.dateFrom || filters.dateFromLte) {
      query.assignedAt = {};
      if (filters.dateFrom) (query.assignedAt as Record<string, Date>).$gte = filters.dateFrom;
      if (filters.dateFromLte) (query.assignedAt as Record<string, Date>).$lte = filters.dateFromLte;
    }

    return WorkOrderAssignmentModel.find(query)
      .sort({ assignedAt: -1 })
      .populate('workOrderId', 'workOrderNumber title status scheduledDate')
      .lean();
  }

  /**
   * Get all assignments for a tenant (for reporting)
   */
  async getAssignmentMetrics(
    tenantId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{
    total: number;
    byType: Record<string, number>;
    byReason: Record<string, number>;
    autoAssignments: number;
    replacements: number;
  }> {
    const match: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    };

    if (dateFrom || dateTo) {
      match.assignedAt = {};
      if (dateFrom) (match.assignedAt as Record<string, Date>).$gte = dateFrom;
      if (dateTo) (match.assignedAt as Record<string, Date>).$lte = dateTo;
    }

    const [total, byType, byReason, autoAssignments, replacements] = await Promise.all([
      WorkOrderAssignmentModel.countDocuments(match),
      WorkOrderAssignmentModel.aggregate([
        { $match: match },
        { $group: { _id: '$assignmentType', count: { $sum: 1 } } },
      ]),
      WorkOrderAssignmentModel.aggregate([
        { $match: match },
        { $group: { _id: '$reason', count: { $sum: 1 } } },
      ]),
      WorkOrderAssignmentModel.countDocuments({ ...match, assignmentType: 'auto_assignment' }),
      WorkOrderAssignmentModel.countDocuments({ ...match, assignmentType: 'replacement' }),
    ]);

    return {
      total,
      byType: byType.reduce((acc, cur) => ({ ...acc, [cur._id]: cur.count }), {}),
      byReason: byReason.reduce((acc, cur) => ({ ...acc, [cur._id]: cur.count }), {}),
      autoAssignments,
      replacements,
    };
  }
}

export const workAssignmentService = new WorkAssignmentService();