import { Types } from 'mongoose';
import {
  ContractModel,
  MaintenancePlanModel,
  MaintenanceScheduleModel,
  ContractEquipmentModel,
} from '../models';
import { IContract } from '../types/contract';
import { IMaintenanceSchedule } from '../types/maintenance-schedule';
import { WorkOrderService } from '../../operations/services/work-order.service';
import { ClientModel, LocationModel, EquipmentModel } from '../../crm/models';
import { logActivity } from '../../audit/activity-logger';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class MaintenanceSchedulerService {
  private workOrderService: WorkOrderService;

  constructor() {
    this.workOrderService = new WorkOrderService();
  }

  /**
   * Generate WorkOrders from pending schedules for a specific contract.
   * Will skip schedules that already have a workOrderId set.
   */
  async generateWorkOrders(
    contractId: string,
    tenantId: string,
    userId: string,
  ): Promise<{ created: number; skipped: number }> {
    const contract = await ContractModel.findOne({ _id: contractId, tenantId, deletedAt: null })
      
      .exec();

    if (!contract) {
      throw new ValidationError('Contract not found');
    }

    const pendingSchedules = await MaintenanceScheduleModel.find({
      tenantId,
      contractId,
      status: 'scheduled',
      workOrderId: null,
    })
      .sort({ scheduledDate: 1 })
      
      .exec();

    if (pendingSchedules.length === 0) {
      return { created: 0, skipped: 0 };
    }

    // Fetch active equipment for this contract
    const contractEquipment = await ContractEquipmentModel.find({
      tenantId,
      contractId,
      removedAt: null,
    })
      
      .exec();

    // Default to first client location for WorkOrder
    const [location] = await LocationModel.find({ clientId: contract.clientId, tenantId })
      .limit(1)
      
      .exec();

    if (!location) {
      throw new ValidationError(
        `Client ${contract.clientId} has no locations. Cannot create WorkOrders.`,
      );
    }

    let created = 0;
    let skipped = 0;

    for (const schedule of pendingSchedules) {
      const plan = await MaintenancePlanModel.findOne({
        _id: schedule.maintenancePlanId,
        tenantId,
        deletedAt: null,
      })
        
        .exec();

      const planName = plan?.name ?? 'Unnamed Plan';

      const equipmentIds = contractEquipment.map((ce) => ce.equipmentId);

      try {
        const wo = await this.workOrderService.create(
          {
            clientId: contract.clientId,
            locationId: location._id,
            equipmentId: equipmentIds.length === 1 ? equipmentIds[0] : null,
            clientSnapshot: contract.clientSnapshot,
            locationSnapshot: {
              name: location.name,
              address: location.address,
              city: location.city,
              province: location.province,
              country: location.country,
              postalCode: location.postalCode,
            },
            equipmentSnapshot: null,
            source: 'maintenance_contract',
            contractSnapshot: {
              contractId: schedule.contractId,
              contractName: contract.name,
              maintenanceScheduleId: schedule._id,
              planName,
              equipmentIds,
            },
            title: `Mantenimiento Preventivo: ${planName} - ${contract.name}`,
            description: `Mantenimiento programado para el contrato ${contract.name}`,
            priority: 'normal',
            category: 'maintenance',
            scheduledDate: schedule.scheduledDate,
            scheduledStart: schedule.scheduledDate,
            scheduledEnd: schedule.scheduledDate,
          },
          tenantId,
          userId,
        );

        await MaintenanceScheduleModel.updateOne(
          { _id: schedule._id },
          { $set: { workOrderId: wo._id, status: 'scheduled' } },
        );

        created++;
      } catch {
        skipped++;
      }
    }

    if (created > 0) {
      await logActivity({
        tenantId,
        entityType: 'contract',
        entityId: contractId,
        action: 'work_order_generated',
        actorId: userId,
        metadata: { created, skipped },
      });
    }

    return { created, skipped };
  }

  /**
   * Generate WorkOrders for all contracts with upcoming schedules.
   * Scans schedules within the given date range across all active contracts.
   */
  async generateWorkOrdersForDateRange(
    tenantId: string,
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ totalCreated: number; totalSkipped: number; contractsProcessed: number }> {
    const schedules = await MaintenanceScheduleModel.find({
      tenantId,
      status: 'scheduled',
      workOrderId: null,
      scheduledDate: { $gte: startDate, $lte: endDate },
    })
      .sort({ scheduledDate: 1 })
      
      .exec();

    const contractIds = [...new Set(schedules.map((s) => s.contractId.toString()))];
    let totalCreated = 0;
    let totalSkipped = 0;

    for (const contractId of contractIds) {
      const result = await this.generateWorkOrders(contractId.toString(), tenantId, userId);
      totalCreated += result.created;
      totalSkipped += result.skipped;
    }

    return {
      totalCreated,
      totalSkipped,
      contractsProcessed: contractIds.length,
    };
  }

  /**
   * Cancel all future schedules for a contract (used when contract expires/cancels).
   */
  async cancelFutureSchedules(
    contractId: string,
    tenantId: string,
    userId: string,
  ): Promise<number> {
    const result = await MaintenanceScheduleModel.updateMany(
      {
        tenantId,
        contractId,
        status: 'scheduled',
        scheduledDate: { $gte: new Date() },
      },
      { $set: { status: 'cancelled' as const } },
    );

    return result.modifiedCount;
  }
}
