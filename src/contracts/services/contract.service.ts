import { Types, FilterQuery } from 'mongoose';
import {
  ContractModel,
  ContractEquipmentModel,
} from '../models';
import {
  IContract,
  CreateContractInput,
  UpdateContractInput,
  ContractStatus,
} from '../types/contract';
import { canTransition } from '../helpers/state-machine';
import { logActivity } from '../../audit/activity-logger';
import { ClientModel } from '../../crm/models';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ContractService {
  async create(
    data: CreateContractInput,
    userId: string,
    tenantId: string,
  ): Promise<IContract> {
    const client = await ClientModel.findById(data.clientId).lean().exec();
    if (!client) {
      throw new ValidationError(`Client ${data.clientId} not found`);
    }

    const contract = await ContractModel.create({
      ...data,
      tenantId,
      status: 'draft',
      clientSnapshot: {
        name: client.fullName || client.companyName,
        email: client.email,
        phone: client.phone,
      },
      createdBy: userId,
      updatedBy: userId,
    });

    await logActivity({
      tenantId,
      entityType: 'contract',
      entityId: contract._id,
      action: 'created',
      actorId: userId,
      metadata: { contractName: data.name },
    });

    return contract.toObject();
  }

  async findById(id: string, tenantId: string): Promise<IContract | null> {
    return ContractModel.findOne({ _id: id, tenantId, deletedAt: null })
      .lean()
      .exec();
  }

  async findByTenant(
    tenantId: string,
    filters: {
      status?: ContractStatus;
      clientId?: string;
    } = {},
  ): Promise<IContract[]> {
    const query: FilterQuery<IContract> = { tenantId, deletedAt: null };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.clientId) {
      query.clientId = new Types.ObjectId(filters.clientId);
    }

    return ContractModel.find(query)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async update(
    id: string,
    data: UpdateContractInput,
    tenantId: string,
    userId: string,
  ): Promise<IContract | null> {
    const contract = await ContractModel.findOneAndUpdate(
      { _id: id, tenantId, deletedAt: null },
      { $set: { ...data, updatedBy: userId } },
      { new: true },
    )
      .lean()
      .exec();

    if (!contract) {
      return null;
    }

    await logActivity({
      tenantId,
      entityType: 'contract',
      entityId: id,
      action: 'updated',
      actorId: userId,
      changes: { before: {}, after: data },
    });

    return contract;
  }

  async changeStatus(
    id: string,
    targetStatus: ContractStatus,
    tenantId: string,
    userId: string,
  ): Promise<IContract | null> {
    const current = await ContractModel.findOne({ _id: id, tenantId, deletedAt: null })
      .select('status')
      .lean()
      .exec();

    if (!current) {
      return null;
    }

    const currentStatus = current.status as ContractStatus;

    if (!canTransition(currentStatus, targetStatus)) {
      throw new ValidationError(
        `Cannot transition from ${currentStatus} to ${targetStatus}`,
      );
    }

    const updated = await ContractModel.findOneAndUpdate(
      { _id: id, tenantId, status: currentStatus },
      { $set: { status: targetStatus, updatedBy: userId } },
      { new: true },
    )
      .lean()
      .exec();

    if (!updated) {
      return null;
    }

    const actionMap: Record<string, 'activated' | 'paused' | 'cancelled' | 'expired'> = {
      active: 'activated',
      paused: 'paused',
      cancelled: 'cancelled',
      expired: 'expired',
    };
    const action = actionMap[targetStatus];

    await logActivity({
      tenantId,
      entityType: 'contract',
      entityId: id,
      action,
      actorId: userId,
      changes: {
        before: { status: currentStatus },
        after: { status: targetStatus },
      },
    });

    return updated;
  }

  async softDelete(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<boolean> {
    const contract = await ContractModel.findOne({ _id: id, tenantId, deletedAt: null })
      .lean()
      .exec();

    if (!contract) {
      return false;
    }

    const status = contract.status as ContractStatus;
    if (status !== 'draft' && status !== 'cancelled') {
      throw new ValidationError(
        `Cannot delete contract in status '${status}'. Only 'draft' or 'cancelled' can be deleted.`,
      );
    }

    await ContractModel.updateOne(
      { _id: id, tenantId },
      { $set: { deletedAt: new Date(), deletedBy: userId } },
    );

    await logActivity({
      tenantId,
      entityType: 'contract',
      entityId: id,
      action: 'deleted',
      actorId: userId,
    });

    return true;
  }

  // ── Equipment Management ───────────────────────────────────

  async addEquipment(
    contractId: string,
    equipmentId: string,
    tenantId: string,
  ): Promise<void> {
    const contract = await ContractModel.findOne({ _id: contractId, tenantId, deletedAt: null })
      .lean()
      .exec();

    if (!contract) {
      throw new ValidationError('Contract not found');
    }

    const existing = await ContractEquipmentModel.findOne({
      tenantId,
      contractId,
      equipmentId,
      removedAt: null,
    })
      .lean()
      .exec();

    if (existing) {
      throw new ValidationError('Equipment is already assigned to this contract');
    }

    await ContractEquipmentModel.create({
      tenantId,
      contractId,
      equipmentId,
      includedAt: new Date(),
    });

    await logActivity({
      tenantId,
      entityType: 'contract',
      entityId: contractId,
      action: 'equipment_added',
      actorId: tenantId,
      metadata: { equipmentId },
    });
  }

  async removeEquipment(
    contractId: string,
    equipmentId: string,
    tenantId: string,
  ): Promise<void> {
    const record = await ContractEquipmentModel.findOne({
      tenantId,
      contractId,
      equipmentId,
      removedAt: null,
    })
      .lean()
      .exec();

    if (!record) {
      throw new ValidationError('Equipment is not assigned to this contract');
    }

    await ContractEquipmentModel.updateOne(
      { _id: record._id },
      { $set: { removedAt: new Date() } },
    );

    await logActivity({
      tenantId,
      entityType: 'contract',
      entityId: contractId,
      action: 'equipment_removed',
      actorId: tenantId,
      metadata: { equipmentId },
    });
  }

  async getEquipment(
    contractId: string,
    tenantId: string,
  ) {
    return ContractEquipmentModel.find({
      tenantId,
      contractId,
      removedAt: null,
    })
      .populate('equipmentId')
      .lean()
      .exec();
  }
}
