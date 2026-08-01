import { Types } from 'mongoose';
import WorkOrderAssignmentModel from '../models/work-order-assignment';
import { IWorkOrderAssignment } from '../models/work-order-assignment';
import WorkOrderModel from '../models/work-order';
import { TechnicianModel } from '../models/technician';
import { NotFoundError, ValidationError } from '@/core/errors';
import { logActivity } from '@/audit/activity-logger';

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
    console.log('[createAssignment] Starting for workOrderId:', workOrderId, 'assignmentType:', options.assignmentType);
    
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

    // BUSINESS RULE: Only ONE active assignment allowed per WorkOrder
    // If there's an existing assignment with a DIFFERENT technician, reject unless it's a replacement
    if (existingAssignment) {
      const existingTechnicianId = (existingAssignment.technicianId as any)?.toString();
      const newTechnicianId = technicianId.toString();
      
      if (existingTechnicianId !== newTechnicianId) {
        // Different technician trying to assign - only allowed if explicitly replacing
        if (options.assignmentType !== 'replacement' && options.assignmentType !== 'redistribution') {
          throw new ValidationError(
            'Ya existe un técnico asignado a esta orden de trabajo. Use la acción "reassign" para reasignar.'
          );
        }
      }
    }

    // Check if this technician already has ANY assignment (even replaced)
    const technicianPreviousAssignment = await WorkOrderAssignmentModel.findOne({
      workOrderId: new Types.ObjectId(workOrderId),
      technicianId: new Types.ObjectId(technicianId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    });

    // If technician already has assignment (any status), update it instead of creating new
    if (technicianPreviousAssignment) {
      // Mark old active assignment as replaced first
      if (existingAssignment && existingAssignment._id.toString() !== technicianPreviousAssignment._id.toString()) {
        await WorkOrderAssignmentModel.findByIdAndUpdate(existingAssignment._id, {
          $set: {
            status: 'replaced',
            replacedAt: new Date(),
            replacedByAssignmentId: null,
          },
        });
      }

      // Update existing record instead of creating new
      await WorkOrderAssignmentModel.findByIdAndUpdate(technicianPreviousAssignment._id, {
        $set: {
          status: 'assigned',
          assignedAt: new Date(),
          assignedBy: new Types.ObjectId(assignedBy),
          assignmentType: options.assignmentType,
          reason: options.reason as any,
          reasonDetail: options.reasonDetail,
          notes: options.notes,
          previousTechnicianId: options.previousTechnicianId
            ? new Types.ObjectId(options.previousTechnicianId)
            : null,
          replacedAt: null,
          deletedAt: null,
        },
      });

      // CRITICAL: Also update the WorkOrder's assignedTechnicians!
      const newTechnicianId = new Types.ObjectId(technicianId);
      console.log('[createAssignment] Updating WorkOrder for existing technician case:', workOrderId);
      await WorkOrderModel.findByIdAndUpdate(workOrderId, {
        $set: { 
          assignedTechnicians: [newTechnicianId],
          status: 'assigned', 
          updatedBy: new Types.ObjectId(assignedBy) 
        },
      });

      return WorkOrderAssignmentModel.findById(technicianPreviousAssignment._id).populate('technicianId', 'name email phone availability');
    }

    // If replacing or redistribution, mark old active one as replaced
    // This applies to: admin reassign (replacement) AND technician self-takeover (redistribution)
    if (existingAssignment && (options.assignmentType === 'replacement' || options.assignmentType === 'redistribution')) {
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
    if (existingAssignment && (options.assignmentType === 'replacement' || options.assignmentType === 'redistribution')) {
      await WorkOrderAssignmentModel.findByIdAndUpdate(existingAssignment._id, {
        $set: {
          replacedByAssignmentId: assignment._id,
        },
      });
    }

    // Update work order's assignedTechnicians - REPLACE (only 1 technician allowed)
    const newTechnicianId = new Types.ObjectId(technicianId);
    
    console.log('[SelfAssign] Updating WorkOrder:', workOrderId, 'with technician:', newTechnicianId);
    
    // Always replace with single technician (1:1 relationship)
    await WorkOrderModel.findByIdAndUpdate(workOrderId, {
      $set: { 
        assignedTechnicians: [newTechnicianId],
        status: 'assigned', 
        updatedBy: new Types.ObjectId(assignedBy) 
      },
    });

    console.log('[SelfAssign] WorkOrder updated successfully!');

    // Log the activity
    const tech = await TechnicianModel.findById(technicianId).lean();
    const actionLabel = options.assignmentType === 'replacement' ? 'reasignó' : 'asignó';
    await logActivity({
      tenantId: new Types.ObjectId(tenantId),
      entityType: 'WorkOrder',
      entityId: workOrderId,
      action: 'assigned',
      actorId: new Types.ObjectId(assignedBy),
      description: `Técnico ${tech?.name || technicianId} ${actionLabel} a ${workOrder.workOrderNumber}`,
    });

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
    
    // If no current assignment but workOrder has assigned technicians, use createAssignment instead
    if (!currentAssignment) {
      // Check if work order has technicians assigned
      const WorkOrderModel = (await import('@/operations/models/work-order')).default;
      const wo = await WorkOrderModel.findById(workOrderId).lean();
      
      if (wo && wo.assignedTechnicians && wo.assignedTechnicians.length > 0) {
        // Use createAssignment instead (it will handle existing technicians)
        return this.createAssignment(workOrderId, newTechnicianId, replacedBy, tenantId, {
          assignmentType: 'replacement',
          reason,
          reasonDetail,
          notes,
        });
      }
      
      throw new ValidationError('No active assignment to replace');
    }

    const currentTechId = String(currentAssignment.technicianId._id || currentAssignment.technicianId);
    
    // If same technician, skip
    if (currentTechId === newTechnicianId) {
      return { message: 'Technician already assigned', assignment: currentAssignment };
    }

    return this.createAssignment(workOrderId, newTechnicianId, replacedBy, tenantId, {
      assignmentType: 'replacement',
      reason,
      reasonDetail,
      notes,
      previousTechnicianId: currentTechId,
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

  /**
   * Self-assign a technician to a work order (technician assigns themselves)
   * 
   * Business rules:
   * - Technician can self-assign to WorkOrders WITHOUT an active assignment
   * - Technician CAN take a WorkOrder from another technician (redistribution)
   */
  async selfAssignTechnician(
    workOrderId: string,
    technicianId: string,
    tenantId: string,
    reason: string,
    observations?: string,
  ): Promise<any> {
    // Check if there's already an active assignment
    const existingAssignment = await WorkOrderAssignmentModel.findOne({
      workOrderId: new Types.ObjectId(workOrderId),
      tenantId: new Types.ObjectId(tenantId),
      status: { $in: ['assigned', 'acknowledged'] },
      deletedAt: null,
    });

    // If no active assignment - proceed with self-assign
    if (!existingAssignment) {
      return this.createAssignment(workOrderId, technicianId, technicianId, tenantId, {
        assignmentType: 'auto_assignment',
        reason,
        notes: observations,
      });
    }

    // There's an existing assignment
    const existingTechId = (existingAssignment.technicianId as any)?.toString();
    
    // If same technician - already assigned, return success (idempotent)
    if (existingTechId === technicianId) {
      return existingAssignment;
    }

    // Different technician - can "take" the WorkOrder from another (redistribution)
    console.log('[selfAssignTechnician] Calling createAssignment with redistribution...');
    return this.createAssignment(workOrderId, technicianId, technicianId, tenantId, {
      assignmentType: 'redistribution',
      reason,
      notes: observations,
      previousTechnicianId: existingTechId,
    });
  }
}

export const workAssignmentService = new WorkAssignmentService();