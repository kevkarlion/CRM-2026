import { ClientModel } from '../models';
import { IClient, CreateClientInput, UpdateClientInput } from '../types/client';

export class ClientService {
  async create(
    data: CreateClientInput,
    tenantId: string,
    userId: string
  ): Promise<IClient> {
    const client = await ClientModel.create({
      ...data,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });
    return client.toObject();
  }

  async findById(id: string, tenantId: string): Promise<IClient | null> {
    return ClientModel.findOne({ _id: id, tenantId, deletedAt: null })
      .lean()
      .exec();
  }

  async findByTenant(
    tenantId: string,
    filter: Record<string, unknown> = {}
  ): Promise<IClient[]> {
    return ClientModel.find({ ...filter, tenantId, deletedAt: null })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async update(
    id: string,
    data: UpdateClientInput,
    tenantId: string,
    userId: string
  ): Promise<IClient | null> {
    return ClientModel.findOneAndUpdate(
      { _id: id, tenantId, deletedAt: null },
      { $set: { ...data, updatedBy: userId } },
      { new: true }
    )
      .lean()
      .exec();
  }

  async softDelete(id: string, tenantId: string, userId: string): Promise<void> {
    await ClientModel.updateOne(
      { _id: id, tenantId },
      { $set: { deletedAt: new Date(), deletedBy: userId } }
    );
    // Cascade soft-delete to children (Contacts, Locations, Equipment, etc.)
    // will be implemented in later PRs when those models exist
  }
}
