import { Types } from 'mongoose';
import { WorkOrderModel, WorkOrderEventModel, VisitReportModel } from '../models';
import { IWorkOrder, CreateWorkOrderInput, UpdateWorkOrderInput, WorkOrderStatus } from '../types/work-order';
import { getNextWorkOrderNumber } from '../helpers/counter';
import { validateTransition, TransitionContext, TransitionError } from '../helpers/state-machine';
import { logActivity } from '../../audit/activity-logger';
import { ClientModel, LocationModel, EquipmentModel } from '../../crm/models';

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
    const client = await ClientModel.findById(data.clientId).lean().exec();
    if (!client) {
      throw new ValidationError(`Client ${data.clientId} not found`);
    }

    const location = await LocationModel.findById(data.locationId).lean().exec();
    if (!location) {
      throw new ValidationError(`Location ${data.locationId} not found`);
    }

    let equipmentSnapshot: Record<string, unknown> | null = null;
    if (data.equipmentId) {
      const equipment = await EquipmentModel.findById(data.equipmentId).lean().exec();
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

    const workOrder = await WorkOrderModel.create({
      ...data,
      tenantId,
      workOrderNumber,
      status: 'draft' as WorkOrderStatus,
      clientSnapshot: {
        name: client.fullName || client.companyName,
        email: client.email,
        phone: client.phone,
        taxId: client.taxId,
        customerType: client.customerType,
        status: client.status,
      },
      locationSnapshot: {
        name: location.name,
        address: location.address,
        city: location.city,
        province: location.province,
        country: location.country,
        postalCode: location.postalCode,
      },
      equipmentSnapshot,
      assignedTechnicians: [],
      createdBy: userId,
      updatedBy: userId,
    });

    await logActivity({
      tenantId,
      entityType: 'workOrder',
      entityId: workOrder._id,
      action: 'created',
      actorId: userId,
    });

    return workOrder.toObject();
  }

  async findById(id: string, tenantId: string): Promise<IWorkOrder | null> {
    return WorkOrderModel.findOne({ _id: id, tenantId, deletedAt: null })
      .lean()
      .exec();
  }

  async findByTenant(
    tenantId: string,
    filters: {
      status?: WorkOrderStatus;
      technicianId?: string;
      scheduledDateGte?: Date;
      scheduledDateLte?: Date;
    } = {},
  ): Promise<IWorkOrder[]> {
    const query: Record<string, unknown> = { tenantId, deletedAt: null };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.technicianId) {
      query.assignedTechnicians = new Types.ObjectId(filters.technicianId);
    }

    if (filters.scheduledDateGte || filters.scheduledDateLte) {
      query.scheduledDate = {};
      if (filters.scheduledDateGte) query.scheduledDate.$gte = filters.scheduledDateGte;
      if (filters.scheduledDateLte) query.scheduledDate.$lte = filters.scheduledDateLte;
    }

    return WorkOrderModel.find(query)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async update(
    id: string,
    data: UpdateWorkOrderInput,
    tenantId: string,
    userId: string,
    version: number,
  ): Promise<IWorkOrder | null> {
    const updated = await WorkOrderModel.findOneAndUpdate(
      { _id: id, tenantId, deletedAt: null, version },
      { $set: { ...data, updatedBy: userId }, $inc: { version: 1 } },
      { new: true },
    )
      .lean()
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
    const current = await WorkOrderModel.findOne({ _id: id, tenantId, deletedAt: null })
      .select('status version')
      .lean()
      .exec();

    if (!current) {
      return null;
    }

    const currentStatus = current.status as WorkOrderStatus;

    validateTransition(currentStatus, targetStatus, context);

    const updated = await WorkOrderModel.findOneAndUpdate(
      { _id: id, tenantId, status: currentStatus, version },
      { $set: { status: targetStatus, updatedBy: userId }, $inc: { version: 1 } },
      { new: true },
    )
      .lean()
      .exec();

    if (!updated) {
      throw new ConflictError(
        `Cannot transition ${currentStatus} → ${targetStatus}: stale version or status already changed.`,
      );
    }

    const eventType = targetStatus === 'cancelled' ? 'closed'
      : targetStatus === 'completed' ? 'visit_completed'
      : 'status_changed';

    await WorkOrderEventModel.create({
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(id),
      eventType,
      description: `Status changed from ${currentStatus} to ${targetStatus}`,
      performedBy: new Types.ObjectId(userId),
      metadata: { from: currentStatus, to: targetStatus },
    });

    await logActivity({
      tenantId,
      entityType: 'workOrder',
      entityId: id,
      action: 'status.change',
      actorId: userId,
      changes: {
        before: { status: currentStatus, version },
        after: { status: targetStatus, version: updated.version },
      },
    });

    return updated;
  }

  async schedule(
    id: string,
    scheduleData: {
      scheduledDate: Date;
      scheduledStart: Date;
      scheduledEnd: Date;
    },
    tenantId: string,
    userId: string,
    version: number,
  ): Promise<IWorkOrder | null> {
    const current = await WorkOrderModel.findOne({ _id: id, tenantId, deletedAt: null })
      .select('status version')
      .lean()
      .exec();

    if (!current) {
      return null;
    }

    const currentStatus = current.status as WorkOrderStatus;

    validateTransition(currentStatus, 'scheduled', {
      hasSchedule: true,
      hasChecklist: false,
      hasTechnicians: false,
      hasVisitReport: false,
    });

    const updated = await WorkOrderModel.findOneAndUpdate(
      { _id: id, tenantId, status: currentStatus, version },
      {
        $set: {
          scheduledDate: scheduleData.scheduledDate,
          scheduledStart: scheduleData.scheduledStart,
          scheduledEnd: scheduleData.scheduledEnd,
          status: 'scheduled',
          updatedBy: userId,
        },
        $inc: { version: 1 },
      },
      { new: true },
    )
      .lean()
      .exec();

    if (!updated) {
      throw new ConflictError(
        `Cannot schedule WorkOrder: stale version or status already changed.`,
      );
    }

    await WorkOrderEventModel.create({
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(id),
      eventType: 'status_changed',
      description: `WorkOrder scheduled on ${scheduleData.scheduledDate.toISOString().slice(0, 10)}`,
      performedBy: new Types.ObjectId(userId),
      metadata: { from: currentStatus, to: 'scheduled', scheduleData },
    });

    await logActivity({
      tenantId,
      entityType: 'workOrder',
      entityId: id,
      action: 'status.change',
      actorId: userId,
      changes: {
        before: { status: currentStatus, version },
        after: { status: 'scheduled', version: updated.version },
      },
    });

    return updated;
  }

  async softDelete(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<boolean> {
    const workOrder = await WorkOrderModel.findOne({ _id: id, tenantId, deletedAt: null })
      .lean()
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
