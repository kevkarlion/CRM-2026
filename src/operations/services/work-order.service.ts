import mongoose, { Types } from 'mongoose';
import { WorkOrderModel, WorkOrderEventModel, VisitReportModel } from '../models';
import WorkOrderAssignmentModel from '../models/work-order-assignment';
import { IWorkOrder, CreateWorkOrderInput, UpdateWorkOrderInput, WorkOrderStatus } from '../types/work-order';
import { getNextWorkOrderNumber } from '../helpers/counter';
import { validateTransition, TransitionContext, TransitionError } from '../helpers/state-machine';
import { logActivity } from '../../audit/activity-logger';
import { ClientModel, LocationModel, EquipmentModel } from '../../crm/models';
import { eventBus } from '@/infrastructure/events/event-bus';
import { DOMAIN_EVENTS, WorkOrderCreatedPayload, WorkOrderStatusChangedPayload, WorkOrderCompletedPayload } from '@/infrastructure/events/event.types';

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class WorkOrderService {
  async create(
    data: CreateWorkOrderInput,
    tenantId: string,
    userId: string,
  ): Promise<IWorkOrder> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validar required fields
      if (!data.clientId) {
        throw new ValidationError('Debe seleccionar un cliente');
      }
      
      const client = await ClientModel.findById(data.clientId).session(session).exec();
      if (!client) {
        throw new ValidationError(`Client ${data.clientId} not found`);
      }

      // Location is optional - either provide locationId (existing) or locationSnapshot (new)
      let location = null;
      if (data.locationId) {
        location = await LocationModel.findById(data.locationId).session(session).exec();
        if (!location) {
          throw new ValidationError(`Location ${data.locationId} not found`);
        }
      }

      let equipmentSnapshot: Record<string, unknown> | null = null;
      if (data.equipmentId) {
        const equipment = await EquipmentModel.findById(data.equipmentId).session(session).exec();
        if (!equipment) {
          throw new ValidationError(`Equipment ${data.equipmentId} not found`);
        }
        equipmentSnapshot = {
          equipmentType: equipment.equipmentType,
          brand: equipment.brand,
          model: equipment.model,
          serialNumber: equipment.serialNumber,
          status: equipment.status,
        };
      }

      const tenantPrefix = tenantId.toString().slice(-6);
      const workOrderNumber = await getNextWorkOrderNumber(tenantPrefix);

      // Sync scheduledDate from scheduledStart (single source of truth)
      const scheduledStart = (data as any).scheduledStart;
      const scheduledDateFromStart = scheduledStart
        ? (typeof scheduledStart === 'string' ? scheduledStart.slice(0, 10) : scheduledStart.toISOString().slice(0, 10))
        : data.scheduledDate;

      // Auto-transition: si tiene fecha Y técnico, crear directamente como "scheduled"
      const hasSchedule = !!(scheduledDateFromStart || (data as any).scheduledStart || (data as any).scheduledEnd);
      const hasTechnicians = !!((data as any).assignedTechnicians && (data as any).assignedTechnicians.length > 0);
      const initialStatus: WorkOrderStatus = (hasSchedule && hasTechnicians) ? 'scheduled' : 'draft';

      const [workOrder] = await WorkOrderModel.create([{
        ...data,
        scheduledDate: scheduledDateFromStart,
        tenantId,
        workOrderNumber,
        status: initialStatus,
        tenantId,
        workOrderNumber,
        status: initialStatus,
        clientSnapshot: {
          name: client.fullName || client.companyName,
          email: client.email,
          phone: client.phone,
          taxId: client.taxId,
          customerType: client.customerType,
          status: client.status,
        },
        locationSnapshot: location 
          ? {
              name: location.name,
              address: location.address,
              city: location.city,
              province: location.province,
              country: location.country,
              postalCode: location.postalCode,
            }
          : data.locationSnapshot,
        equipmentSnapshot,
        assignedTechnicians: (data as any).assignedTechnicians || [],
        createdBy: userId,
        updatedBy: userId,
      }], { session });

      // Crear WorkOrderAssignment para cada técnico asignado
      const assignedTechs = (data as any).assignedTechnicians || [];
      if (assignedTechs.length > 0) {
        const assignments = assignedTechs.map((techId: string) => ({
          workOrderId: workOrder._id,
          technicianId: new Types.ObjectId(techId),
          tenantId: new Types.ObjectId(tenantId),
          status: initialStatus === 'scheduled' ? 'scheduled' : 'assigned',
          assignedAt: new Date(),
          acknowledgedAt: null,
          startedAt: null,
          completedAt: null,
          deletedAt: null,
          assignmentType: 'manual' as const,
          reason: 'other' as const,
        }));
        await WorkOrderAssignmentModel.insertMany(assignments, { session });
      }

      // Guardar evento de creación en el historial
      await WorkOrderEventModel.create([{
        tenantId: new Types.ObjectId(tenantId),
        workOrderId: workOrder._id,
        eventType: 'created',
        description: `Orden de trabajo creada por el usuario`,
        performedBy: new Types.ObjectId(userId),
        metadata: {
          workOrderNumber: workOrder.workOrderNumber,
          title: workOrder.title,
          category: workOrder.category,
          priority: workOrder.priority,
          scheduledDate: workOrder.scheduledDate,
          scheduledStart: workOrder.scheduledStart,
          scheduledEnd: workOrder.scheduledEnd,
          initialStatus: initialStatus,
        },
      }], { session });

      await session.commitTransaction();

      try {
        await eventBus.publish({
          type: DOMAIN_EVENTS.WORK_ORDER_CREATED,
          aggregateId: workOrder._id.toString(),
          aggregateType: 'WorkOrder',
          tenantId,
          userId,
          timestamp: new Date(),
          payload: {
            workOrderId: workOrder._id.toString(),
            leadId: workOrder.leadId?.toString() || null,
            number: workOrder.workOrderNumber,
            clientId: workOrder.clientId.toString(),
            title: workOrder.title,
            category: workOrder.category,
            priority: workOrder.priority,
            scheduledDate: workOrder.scheduledDate,
            clientName: client.fullName || client.companyName || undefined,
            address: location.address || undefined,
          } as WorkOrderCreatedPayload,
        });
      } catch (eventError) {
        console.error('[WorkOrderService] Failed to publish WORK_ORDER_CREATED:', eventError);
      }

      return workOrder.toObject();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async findById(id: string, tenantId: string): Promise<IWorkOrder | null> {
    return WorkOrderModel.findOne({ _id: id, tenantId, deletedAt: null })
      .populate('assignedTechnicians', 'name email phone specialties')
      .exec();
  }

  async findByTenant(
    tenantId: string,
    filters: {
      status?: WorkOrderStatus;
      technicianId?: string;
      clientId?: string;
      scheduledDateGte?: string;
      scheduledDateLte?: string;
      scheduledDateLt?: string;
      statusNin?: string[];
    } = {},
  ): Promise<IWorkOrder[]> {
    const query: Record<string, unknown> = { tenantId, deletedAt: null };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.statusNin) {
      query.status = { $nin: filters.statusNin };
    }

    if (filters.priority) {
      query.priority = filters.priority;
    }

    if (filters.technicianId) {
      query.assignedTechnicians = new Types.ObjectId(filters.technicianId);
    }

    if (filters.clientId) {
      query.clientId = new Types.ObjectId(filters.clientId);
    }

    if (filters.leadId) {
      query.leadId = new Types.ObjectId(filters.leadId);
    }

    if (filters.scheduledDateGte || filters.scheduledDateLte || filters.scheduledDateLt) {
      const dateFilter: Record<string, unknown> = {};
      if (filters.scheduledDateGte) dateFilter.$gte = filters.scheduledDateGte;
      if (filters.scheduledDateLte) dateFilter.$lte = filters.scheduledDateLte;
      if (filters.scheduledDateLt) dateFilter.$lt = filters.scheduledDateLt;
      query.scheduledDate = dateFilter;
    }

    // Search by title or client name
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { title: searchRegex },
        { 'clientSnapshot.name': searchRegex },
      ];
    }

    return WorkOrderModel.find(query)
      .sort({ createdAt: -1 })
      .populate('assignedTechnicians', 'name email specialties')
      .exec();
  }

  async update(
    id: string,
    data: UpdateWorkOrderInput,
    tenantId: string,
    userId: string,
    version: number,
  ): Promise<IWorkOrder | null> {
    // Auto-transition: si se programa y está en "Borrador", pasar a "Programada"
    const isScheduling = !!(data.scheduledDate || data.scheduledStart || data.scheduledEnd);
    let autoStatus: string | undefined;

    if (isScheduling) {
      const current = await WorkOrderModel.findOne({ _id: id, tenantId, deletedAt: null }).select('status version').lean();
      if (current && current.status === 'draft') {
        autoStatus = 'scheduled';
      }
    }

    // Sync scheduledDate from scheduledStart (single source of truth)
    const dataAny = data as any;
    const scheduledStart = dataAny.scheduledStart;
    const scheduledDateFromStart = scheduledStart !== undefined
      ? (typeof scheduledStart === 'string' ? scheduledStart.slice(0, 10) : scheduledStart.toISOString().slice(0, 10))
      : data.scheduledDate;

    // Si viene scheduledStart pero no scheduledDate, derivar scheduledDate
    if (scheduledStart !== undefined && !data.scheduledDate) {
      (data as any).scheduledDate = scheduledDateFromStart;
    }

    const updated = await WorkOrderModel.findOneAndUpdate(
      { _id: id, tenantId, deletedAt: null, version },
      { $set: { ...data, ...(autoStatus ? { status: autoStatus } : {}), updatedBy: userId }, $inc: { version: 1 } },
      { new: true },
    )
      .exec();

    if (!updated) {
      const exists = await WorkOrderModel.exists({ _id: id, tenantId });
      if (exists) {
        throw new ConflictError('WorkOrder was modified by another user. Please refresh and retry.');
      }
      return null;
    }

    return updated;
  }

  async changeStatus(
    id: string,
    targetStatus: WorkOrderStatus,
    context: TransitionContext,
    tenantId: string,
    userId: string,
    version: number,
  ): Promise<IWorkOrder | null> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const current = await WorkOrderModel.findOne({ _id: id, tenantId, deletedAt: null })
        .select('status version workOrderNumber title category clientId')
        .session(session)
        .exec();

      if (!current) {
        await session.abortTransaction();
        session.endSession();
        return null;
      }

      const currentStatus = current.status as string;

      // Skip validation for legacy statuses - just allow the transition
      const CANONICAL_STATUSES = ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'];
      if (!CANONICAL_STATUSES.includes(currentStatus)) {
        // Legacy status - allow transition to scheduled if has schedule
        console.log(`[changeStatus] Legacy status detected: ${currentStatus} → ${targetStatus}, allowing transition`);
      } else {
        validateTransition(currentStatus, targetStatus, context);
      }

      const updated = await WorkOrderModel.findOneAndUpdate(
        { _id: id, tenantId, status: currentStatus, version },
        {
          $set: {
            status: targetStatus,
            updatedBy: userId,
            ...(targetStatus === 'completed' ? { closedAt: new Date() } : {}),
          },
          $inc: { version: 1 },
        },
        { new: true },
      )
        .session(session)
        .exec();

      if (!updated) {
        throw new ConflictError(
          `Cannot transition ${currentStatus} → ${targetStatus}: stale version or status already changed.`,
        );
      }

      const eventType = targetStatus === 'cancelled' ? 'cancelled'
        : targetStatus === 'completed' ? 'visit_completed'
        : 'status_changed';

      await WorkOrderEventModel.create([{
        tenantId: new Types.ObjectId(tenantId),
        workOrderId: new Types.ObjectId(id),
        eventType,
        description: `Status changed from ${currentStatus} to ${targetStatus}`,
        performedBy: new Types.ObjectId(userId),
        metadata: { from: currentStatus, to: targetStatus },
      }], { session });

      await session.commitTransaction();

      try {
        await eventBus.publish({
          type: DOMAIN_EVENTS.WORK_ORDER_STATUS_CHANGED,
          aggregateId: id,
          aggregateType: 'WorkOrder',
          tenantId,
          userId,
          timestamp: new Date(),
          payload: {
            workOrderId: id,
            from: currentStatus,
            to: targetStatus,
            number: current.workOrderNumber,
            title: current.title,
            category: current.category,
          } as WorkOrderStatusChangedPayload,
        });

        // Also publish WORK_ORDER_COMPLETED when status is completed
        if (targetStatus === 'completed') {
          await eventBus.publish({
            type: DOMAIN_EVENTS.WORK_ORDER_COMPLETED,
            aggregateId: id,
            aggregateType: 'WorkOrder',
            tenantId,
            userId,
            timestamp: new Date(),
            payload: {
              workOrderId: id,
              number: current.workOrderNumber,
              clientId: current.clientId?.toString() || null,
            } as WorkOrderCompletedPayload,
          });
        }
      } catch (eventError) {
        console.error('[WorkOrderService] Failed to publish WORK_ORDER_STATUS_CHANGED:', eventError);
      }

      return updated;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async schedule(
    id: string,
    scheduleData: {
      scheduledDate: string;
      scheduledStart: Date;
      scheduledEnd: Date;
    },
    tenantId: string,
    userId: string,
    version: number,
  ): Promise<IWorkOrder | null> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const current = await WorkOrderModel.findOne({ _id: id, tenantId, deletedAt: null })
        .select('status version workOrderNumber title category')
        .session(session)
        .exec();

      if (!current) {
        await session.abortTransaction();
        session.endSession();
        return null;
      }

      const currentStatus = current.status as WorkOrderStatus;

      validateTransition(currentStatus, 'scheduled', {
        hasSchedule: true,
        hasChecklist: false,
        hasTechnicians: false,
        hasVisitReport: false,
      });

      // Sync scheduledDate from scheduledStart (single source of truth)
      const syncedScheduledDate = typeof scheduleData.scheduledStart === 'string'
        ? scheduleData.scheduledStart.slice(0, 10)
        : scheduleData.scheduledStart.toISOString().slice(0, 10);

      const updated = await WorkOrderModel.findOneAndUpdate(
        { _id: id, tenantId, status: currentStatus, version },
        {
          $set: {
            scheduledDate: syncedScheduledDate,
            scheduledStart: scheduleData.scheduledStart,
            scheduledEnd: scheduleData.scheduledEnd,
            status: 'scheduled',
            updatedBy: userId,
          },
          $inc: { version: 1 },
        },
        { new: true },
      )
        .session(session)
        .exec();

      if (!updated) {
        throw new ConflictError(
          `Cannot schedule WorkOrder: stale version or status already changed.`,
        );
      }

      await WorkOrderEventModel.create([{
        tenantId: new Types.ObjectId(tenantId),
        workOrderId: new Types.ObjectId(id),
        eventType: 'status_changed',
        description: `WorkOrder scheduled on ${scheduleData.scheduledDate}`,
        performedBy: new Types.ObjectId(userId),
        metadata: { from: currentStatus, to: 'scheduled', scheduleData },
      }], { session });

      await session.commitTransaction();

      try {
        await eventBus.publish({
          type: DOMAIN_EVENTS.WORK_ORDER_STATUS_CHANGED,
          aggregateId: id,
          aggregateType: 'WorkOrder',
          tenantId,
          userId,
          timestamp: new Date(),
          payload: {
            workOrderId: id,
            from: currentStatus,
            to: 'scheduled',
            number: current.workOrderNumber,
            title: current.title,
            category: current.category,
          } as WorkOrderStatusChangedPayload,
        });
      } catch (eventError) {
        console.error('[WorkOrderService] Failed to publish WORK_ORDER_STATUS_CHANGED:', eventError);
      }

      return updated;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async softDelete(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<boolean> {
    const workOrder = await WorkOrderModel.findOne({ _id: id, tenantId, deletedAt: null })
      
      .exec();

    if (!workOrder) {
      return false;
    }

    const status = workOrder.status as WorkOrderStatus;
    if (status !== 'draft' && status !== 'cancelled') {
      throw new ValidationError(
        `Cannot delete WorkOrder in status '${status}'. Only 'draft' or 'cancelled' can be deleted.`,
      );
    }

    const visitReportExists = await VisitReportModel.exists({
      workOrderId: id,
      tenantId,
      deletedAt: null,
    });

    if (visitReportExists) {
      throw new ValidationError(
        'Cannot delete WorkOrder with an existing VisitReport.',
      );
    }

    const eventExists = await WorkOrderEventModel.exists({
      workOrderId: id,
      tenantId,
    });

    if (eventExists) {
      throw new ValidationError(
        'Cannot delete WorkOrder with existing events.',
      );
    }

    await WorkOrderModel.updateOne(
      { _id: id, tenantId },
      { $set: { deletedAt: new Date(), deletedBy: userId } },
    );

    await logActivity({
      tenantId,
      entityType: 'workOrder',
      entityId: id,
      action: 'deleted',
      actorId: userId,
    });

    return true;
  }
}
