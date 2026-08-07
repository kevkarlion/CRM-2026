import { Types } from 'mongoose';
import { ClientModel, ContactModel, LocationModel, EquipmentModel, TaskModel } from '../models';
import { cursorPage } from '../helpers/cursor-pagination';
import { IClient, ClientStatus, CustomerType, CreateClientInput, UpdateClientInput } from '../types/client';

export interface ClientListFilters {
  status?: ClientStatus;
  customerType?: CustomerType;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface ClientListResult {
  data: IClient[];
  cursor?: string;
  total: number;
}

export class ClientService {
  async listClients(
    filters: ClientListFilters,
    tenantId: string,
  ): Promise<ClientListResult> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    };

    if (filters.status) {
      filter.status = filters.status;
    }

    if (filters.customerType) {
      filter.customerType = filters.customerType;
    }

    if (filters.search) {
      const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { fullName: { $regex: escaped, $options: 'i' } },
        { companyName: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
      ];
    }

    const total = await ClientModel.countDocuments(filter).exec();

    const page = await cursorPage(ClientModel, filter, {
      limit: filters.limit || 20,
      cursor: filters.cursor,
      sort: { createdAt: -1 },
    } as never);

    return {
      data: page.data as unknown as IClient[],
      cursor: page.cursor ?? undefined,
      total,
    };
  }

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
      
      .exec() as unknown as Promise<IClient | null>;
  }

  async findByTenant(
    tenantId: string,
    filter: Record<string, unknown> = {}
  ): Promise<IClient[]> {
    return ClientModel.find({ ...filter, tenantId, deletedAt: null })
      .sort({ createdAt: -1 })
      
      .exec() as unknown as Promise<IClient[]>;
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
      
      .exec() as unknown as Promise<IClient | null>;
  }

  async softDelete(id: string, tenantId: string, userId: string): Promise<void> {
    await ClientModel.updateOne(
      { _id: id, tenantId },
      { $set: { deletedAt: new Date(), deletedBy: userId } }
    );

    // Cascade soft-delete to Contacts
    await ContactModel.updateMany(
      { clientId: id, deletedAt: null },
      { $set: { deletedAt: new Date(), deletedBy: userId } }
    );

    // Cascade soft-delete to Locations (and via Location cascade to Equipment)
    const locations = await LocationModel.find({ clientId: id, deletedAt: null })
      .select('_id')
      
      .exec();

    const locationIds = locations.map((l) => l._id);

    if (locationIds.length > 0) {
      // Soft-delete Equipment at all locations
      await EquipmentModel.updateMany(
        { locationId: { $in: locationIds }, deletedAt: null },
        { $set: { deletedAt: new Date(), deletedBy: userId } }
      );

      // Soft-delete locations
      await LocationModel.updateMany(
        { _id: { $in: locationIds } },
        { $set: { deletedAt: new Date(), deletedBy: userId } }
      );
    }

    // Cascade soft-delete polymorphic Tasks linked to this client
    await TaskModel.updateMany(
      { entityType: 'client', entityId: id, tenantId, deletedAt: null },
      { $set: { deletedAt: new Date(), deletedBy: userId } }
    );
    // Activity (append-only) and Attachment (immutable metadata) are NOT soft-deleted
    // Activity entries remain as historical record; Attachments remain for audit trail
  }
}
