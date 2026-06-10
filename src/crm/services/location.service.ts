import { LocationModel, EquipmentModel } from '../models';
import { ILocation, CreateLocationInput, UpdateLocationInput } from '../types/location';
import { Types } from 'mongoose';

export class LocationService {
  async create(
    data: CreateLocationInput,
    tenantId: string,
    userId: string
  ): Promise<ILocation> {
    const location = await LocationModel.create({
      ...data,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });
    return location.toObject();
  }

  async findById(id: string, tenantId: string): Promise<ILocation | null> {
    return LocationModel.findOne({ _id: id, tenantId, deletedAt: null })
      .lean()
      .exec();
  }

  async findByClient(
    clientId: string,
    tenantId: string
  ): Promise<ILocation[]> {
    return LocationModel.find({ clientId, tenantId, deletedAt: null })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async update(
    id: string,
    data: UpdateLocationInput & { clientId?: string },
    tenantId: string,
    userId: string
  ): Promise<ILocation | null> {
    // If clientId is changing, sync Equipment at this location
    if (data.clientId) {
      const current = await LocationModel.findOne({ _id: id, tenantId, deletedAt: null })
        .lean()
        .exec();
      if (current && current.clientId.toString() !== data.clientId) {
        await EquipmentModel.updateMany(
          { locationId: id, deletedAt: null },
          { $set: { clientId: new Types.ObjectId(data.clientId) } }
        );
      }
    }

    return LocationModel.findOneAndUpdate(
      { _id: id, tenantId, deletedAt: null },
      { $set: { ...data, updatedBy: userId } },
      { new: true }
    )
      .lean()
      .exec();
  }

  async softDelete(id: string, tenantId: string, userId: string): Promise<void> {
    await LocationModel.updateOne(
      { _id: id, tenantId },
      { $set: { deletedAt: new Date(), deletedBy: userId } }
    );

    // Cascade soft-delete to Equipment at this location
    await EquipmentModel.updateMany(
      { locationId: id, deletedAt: null },
      { $set: { deletedAt: new Date(), deletedBy: userId } }
    );
  }
}
