import { Types, FilterQuery } from 'mongoose';
import {
  MaintenancePlanModel,
  MaintenanceScheduleModel,
  ContractModel,
} from '../models';
import {
  IMaintenancePlan,
  CreateMaintenancePlanInput,
  UpdateMaintenancePlanInput,
} from '../types/maintenance-plan';
import { ContractStatus } from '../types/contract';
import { planUnitToContractFrequency, generateScheduleDates } from '../helpers/scheduler';
import { logActivity } from '../../audit/activity-logger';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class MaintenancePlanService {
  async create(
    contractId: string,
    data: CreateMaintenancePlanInput,
    userId: string,
    tenantId: string,
  ): Promise<IMaintenancePlan> {
    const contract = await ContractModel.findOne({ _id: contractId, tenantId, deletedAt: null })
      .lean()
      .exec();

    if (!contract) {
      throw new ValidationError('Contract not found');
    }

    const plan = await MaintenancePlanModel.create({
      ...data,
      contractId,
      tenantId,
      active: true,
      createdBy: userId,
      updatedBy: userId,
    });

    await logActivity({
      tenantId,
      entityType: 'contract',
      entityId: contractId,
      action: 'updated',
      actorId: userId,
      metadata: { maintenancePlanCreated: plan._id.toString(), planName: data.name },
    });

    return plan.toObject();
  }

  async findByContract(
    contractId: string,
    tenantId: string,
  ): Promise<IMaintenancePlan[]> {
    return MaintenancePlanModel.find({
      tenantId,
      contractId,
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async findById(
    id: string,
    tenantId: string,
  ): Promise<IMaintenancePlan | null> {
    return MaintenancePlanModel.findOne({ _id: id, tenantId, deletedAt: null })
      .lean()
      .exec();
  }

  async update(
    id: string,
    data: UpdateMaintenancePlanInput,
    tenantId: string,
    userId: string,
  ): Promise<IMaintenancePlan | null> {
    const plan = await MaintenancePlanModel.findOneAndUpdate(
      { _id: id, tenantId, deletedAt: null },
      { $set: { ...data, updatedBy: userId } },
      { new: true },
    )
      .lean()
      .exec();

    if (plan) {
      await logActivity({
        tenantId,
        entityType: 'contract',
        entityId: plan.contractId.toString(),
        action: 'updated',
        actorId: userId,
        metadata: { maintenancePlanUpdated: id },
      });
    }

    return plan;
  }

  async generateSchedules(
    contractId: string,
    tenantId: string,
    userId: string,
  ): Promise<number> {
    const contract = await ContractModel.findOne({ _id: contractId, tenantId, deletedAt: null })
      .lean()
      .exec();

    if (!contract) {
      throw new ValidationError('Contract not found');
    }

    if (contract.status !== ('active' as ContractStatus)) {
      throw new ValidationError('Cannot generate schedules for a non-active contract');
    }

    const plans = await MaintenancePlanModel.find({
      tenantId,
      contractId,
      active: true,
      deletedAt: null,
    })
      .lean()
      .exec();

    if (plans.length === 0) {
      throw new ValidationError('No active maintenance plans found for this contract');
    }

    let totalSchedules = 0;

    for (const plan of plans) {
      const frequency = planUnitToContractFrequency(plan.interval, plan.unit);
      const dates = generateScheduleDates(
        contract.startDate,
        contract.endDate,
        frequency,
      );

      for (const scheduledDate of dates) {
        const existing = await MaintenanceScheduleModel.findOne({
          tenantId,
          contractId,
          maintenancePlanId: plan._id,
          scheduledDate,
        })
          .lean()
          .exec();

        if (existing) continue;

        await MaintenanceScheduleModel.create({
          tenantId,
          contractId,
          maintenancePlanId: plan._id,
          equipmentIds: [],
          scheduledDate,
          status: 'scheduled',
          workOrderId: null,
        });

        totalSchedules++;
      }
    }

    return totalSchedules;
  }
}
