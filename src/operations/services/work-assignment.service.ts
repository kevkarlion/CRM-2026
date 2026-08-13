import { Types } from 'mongoose';
import WorkOrderAssignmentModel from '../models/work-order-assignment';
import { IWorkOrderAssignment } from '../models/work-order-assignment';
import WorkOrderModel from '../models/work-order';
import { TechnicianModel } from '../models/technician';
import { NotFoundError, ValidationError } from '@/core/errors';
import { eventBus } from '@/infrastructure/events/event-bus';
import { DOMAIN_EVENTS, WorkOrderTechnicianAssignmentPayload } from '@/infrastructure/events/event.types';

const PROMOTABLE_STATUSES = ['scheduled', 'confirmed'];
const PUBLISHABLE_ASSIGNMENT_TYPES = ['initial', 'manual', 'replacement'];

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
      } else {
        // Same technician already active - idempotent no-op (no write, no event)
        return existingAssignment;
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
      // previousTechnicianId must come from the ACTIVE assignment being replaced,
      // never from client-supplied options.previousTechnicianId (REQ-TAE-03).
      const derivedPreviousTechnicianId = existingAssignment
        ? (existingAssignment.technicianId as any)?.toString() || null
        : null;

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
          previousTechnicianId: derivedPreviousTechnicianId
            ? new Types.ObjectId(derivedPreviousTechnicianId)
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
          updatedBy: new Types.ObjectId(assignedBy),
        },
      });

      // Promote status: draft → scheduled (if has date or technician)
      // Check current status and promote appropriately
      const workOrderForPromotion = await WorkOrderModel.findById(workOrderId).select('status scheduledDate').lean();
      if (workOrderForPromotion) {
        // If in draft → promote to scheduled (any scheduling action triggers this)
        if (workOrderForPromotion.status === 'draft') {
          await WorkOrderModel.updateOne(
            { _id: new Types.ObjectId(workOrderId), tenantId: new Types.ObjectId(tenantId), status: 'draft' },
            { $set: { status: 'scheduled' } },
          );
          console.log('[createAssignment] Promoted work order from draft to scheduled');
        }
        // Note: No more 'assigned' state - the canonical flow is draft → scheduled → in_progress
      }

      if (PUBLISHABLE_ASSIGNMENT_TYPES.includes(options.assignmentType)) {
        await this.publishTechnicianAssignment({
          workOrder,
          technicianId,
          previousTechnicianId: derivedPreviousTechnicianId,
          assignmentType: options.assignmentType,
          reason: options.reason,
          reasonDetail: options.reasonDetail,
          fromStatus: workOrder.status,
          toStatus: PROMOTABLE_STATUSES.includes(workOrder.status) ? 'assigned' : undefined,
          tenantId,
          userId: assignedBy,
        });
      }

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

    // previousTechnicianId must come from the ACTIVE assignment being replaced,
    // never from client-supplied options.previousTechnicianId (REQ-TAE-03).
    const derivedPreviousTechnicianId = existingAssignment
      ? (existingAssignment.technicianId as any)?.toString() || null
      : null;

    // Create the new assignment
    const assignment = await WorkOrderAssignmentModel.create({
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(workOrderId),
      technicianId: new Types.ObjectId(technicianId),
      previousTechnicianId: derivedPreviousTechnicianId
        ? new Types.ObjectId(derivedPreviousTechnicianId)
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
        updatedBy: new Types.ObjectId(assignedBy) 
      },
    });

    // Promote status: draft → scheduled (if has date or technician)
    // Check current status and promote appropriately
    const workOrderForPromotion = await WorkOrderModel.findById(workOrderId).select('status scheduledDate').lean();
    if (workOrderForPromotion) {
      // If in draft → promote to scheduled
      if (workOrderForPromotion.status === 'draft') {
        await WorkOrderModel.updateOne(
          { _id: new Types.ObjectId(workOrderId), tenantId: new Types.ObjectId(tenantId), status: 'draft' },
          { $set: { status: 'scheduled' } },
        );
        console.log('[SelfAssign] Promoted work order from draft to scheduled');
      }
      // Note: No more 'assigned' state - canonical flow is draft → scheduled → in_progress
    }

    console.log('[SelfAssign] WorkOrder updated successfully!');

    if (PUBLISHABLE_ASSIGNMENT_TYPES.includes(options.assignmentType)) {
      await this.publishTechnicianAssignment({
        workOrder,
        technicianId,
        previousTechnicianId: derivedPreviousTechnicianId,
        assignmentType: options.assignmentType,
        reason: options.reason,
        reasonDetail: options.reasonDetail,
        fromStatus: workOrder.status,
        toStatus: PROMOTABLE_STATUSES.includes(workOrder.status) ? 'assigned' : undefined,
        tenantId,
        userId: assignedBy,
      });
    }

    return assignment;
  }

  /**
   * Publish a technician assignment domain event (best-effort, never throw).
   * The audit handler is the SOLE ActivityLog writer (REQ-TAE-08); the service
   * never logs directly.
   */
  private async publishTechnicianAssignment(opts: {
    workOrder: any;
    technicianId: string;
    previousTechnicianId: string | null;
    assignmentType: string;
    reason: string;
    reasonDetail?: string;
    fromStatus?: string;
    toStatus?: string;
    tenantId: string;
    userId: string;
  }): Promise<void> {
    const isChanged = Boolean(opts.previousTechnicianId);
    const type = isChanged
      ? DOMAIN_EVENTS.WORK_ORDER_TECHNICIAN_CHANGED
      : DOMAIN_EVENTS.WORK_ORDER_TECHNICIAN_ASSIGNED;

    try {
      // Enrichment reads stay INSIDE the best-effort boundary: a failed read
      // must never break the persisted operation (REQ-TAE-02).
      const [technician, previousTechnician] = await Promise.all([
        TechnicianModel.findById(opts.technicianId).lean(),
        opts.previousTechnicianId
          ? TechnicianModel.findById(opts.previousTechnicianId).lean()
          : Promise.resolve(null),
      ]);

      await eventBus.publish({
        type,
        aggregateId: String(opts.workOrder._id),
        aggregateType: 'WorkOrder',
        tenantId: opts.tenantId,
        userId: opts.userId,
        timestamp: new Date(),
        payload: {
          workOrderId: String(opts.workOrder._id),
          number: opts.workOrder.workOrderNumber,
          leadId: opts.workOrder.leadId ? String(opts.workOrder.leadId) : null,
          technicianId: opts.technicianId,
          technicianName: (technician as any)?.name || opts.technicianId,
          previousTechnicianId: opts.previousTechnicianId || null,
          previousTechnicianName: isChanged
            ? (previousTechnician as any)?.name || null
            : null,
          assignmentType: opts.assignmentType,
          reason: opts.reason,
          reasonDetail: opts.reasonDetail,
          fromStatus: opts.fromStatus,
          toStatus: opts.toStatus,
        } as WorkOrderTechnicianAssignmentPayload,
      });
    } catch (eventError) {
      console.error(`[WorkAssignmentService] Failed to publish ${type}:`, eventError);
    }
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
   * Unassign a technician from a work order (admin-initiated).
   *
   * Business rules (REQ-WOU-01..05):
   * - No active assignment (or active technician differs) -> reject with no writes/events.
   * - The active assignment leaves the active set via 'declined' + declinedAt.
   * - Clears the WO denormalized assignedTechnicians array.
   * - Downgrades status to 'confirmed' ONLY from 'scheduled'/'assigned'
   *   (advanced statuses never touched, per assignment-reconciliation invariant).
   * - Publishes WORK_ORDER_TECHNICIAN_UNASSIGNED (best-effort) with fromStatus/toStatus;
   *   never publishes WORK_ORDER_STATUS_CHANGED.
   */
  async unassignTechnician(
    workOrderId: string,
    technicianId: string,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    const activeAssignment = await WorkOrderAssignmentModel.findOne({
      workOrderId: new Types.ObjectId(workOrderId),
      tenantId: new Types.ObjectId(tenantId),
      status: { $in: ['assigned', 'acknowledged'] },
      deletedAt: null,
    }).lean();

    if (!activeAssignment) {
      throw new NotFoundError('Active assignment not found for this work order');
    }

    const activeTechnicianId = String((activeAssignment.technicianId as any)?.toString());
    if (activeTechnicianId !== technicianId.toString()) {
      throw new ValidationError('The active assignment belongs to a different technician');
    }

    const workOrder = await WorkOrderModel.findOne({
      _id: new Types.ObjectId(workOrderId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    }).lean();

    if (!workOrder) {
      throw new NotFoundError('Work order not found');
    }

    // Active assignment leaves the active set (no 'unassigned' enum value exists)
    await WorkOrderAssignmentModel.findByIdAndUpdate(activeAssignment._id, {
      $set: { status: 'declined', declinedAt: new Date() },
    });

    // Clear the denormalized technicians array
    const updatedWorkOrder = await WorkOrderModel.findByIdAndUpdate(
      { _id: new Types.ObjectId(workOrderId), tenantId: new Types.ObjectId(tenantId), deletedAt: null },
      { $pull: { assignedTechnicians: technicianId } },
      { new: true },
    );

    // Downgrade ONLY from scheduled/assigned (advanced statuses untouched)
    const canDowngrade = ['scheduled', 'assigned'].includes((workOrder as any).status);
    await WorkOrderModel.updateOne(
      {
        _id: new Types.ObjectId(workOrderId),
        tenantId: new Types.ObjectId(tenantId),
        status: { $in: ['scheduled', 'assigned'] },
      },
      { $set: { status: 'confirmed' } },
    );

    try {
      // Technician name enrichment stays INSIDE the best-effort boundary.
      const technician = await TechnicianModel.findById(technicianId).lean();

      await eventBus.publish({
        type: DOMAIN_EVENTS.WORK_ORDER_TECHNICIAN_UNASSIGNED,
        aggregateId: workOrderId,
        aggregateType: 'WorkOrder',
        tenantId,
        userId,
        timestamp: new Date(),
        payload: {
          workOrderId,
          number: (workOrder as any).workOrderNumber,
          leadId: (workOrder as any).leadId ? String((workOrder as any).leadId) : null,
          technicianId,
          technicianName: (technician as any)?.name || technicianId,
          previousTechnicianId: null,
          previousTechnicianName: null,
          assignmentType: (activeAssignment as any).assignmentType || 'manual',
          reason: (activeAssignment as any).reason || 'other',
          fromStatus: (workOrder as any).status,
          toStatus: canDowngrade ? 'confirmed' : undefined,
        } as WorkOrderTechnicianAssignmentPayload,
      });
    } catch (eventError) {
      console.error('[WorkAssignmentService] Failed to publish WORK_ORDER_TECHNICIAN_UNASSIGNED:', eventError);
    }

    return { assignment: activeAssignment, workOrder: updatedWorkOrder };
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