import { LocationModel } from '../models';
import { ILocation, CreateLocationInput, UpdateLocationInput } from '../types/location';

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
    data: UpdateLocationInput,
    tenantId: string,
    userId: string
  ): Promise<ILocation | null> {
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
    // Equipment cascade (sync clientId on location re-parent + soft-delete)
    // will be implemented in PR3 when Equipment model exists
  }
}
