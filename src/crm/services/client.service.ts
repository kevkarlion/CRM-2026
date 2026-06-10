import { ClientModel, ContactModel, LocationModel, EquipmentModel, TaskModel } from '../models';
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

    // Cascade soft-delete to Contacts
    await ContactModel.updateMany(
      { clientId: id, deletedAt: null },
      { $set: { deletedAt: new Date(), deletedBy: userId } }
    );

    // Cascade soft-delete to Locations (and via Location cascade to Equipment)
    const locations = await LocationModel.find({ clientId: id, deletedAt: null })
      .select('_id')
      .lean()
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
