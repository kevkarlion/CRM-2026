import { EquipmentModel, LocationModel } from '../models';
import { IEquipment, CreateEquipmentInput, UpdateEquipmentInput } from '../types/equipment';

export class EquipmentService {
  async create(
    data: CreateEquipmentInput,
    tenantId: string,
    userId: string
  ): Promise<IEquipment> {
    // Resolve clientId from location
    const location = await LocationModel.findOne({
      _id: data.locationId,
      tenantId,
      deletedAt: null,
    })
      .select('clientId')
      
      .exec();

    if (!location) {
      throw new Error(`Location ${data.locationId} not found or is deleted`);
    }

    const equipment = await EquipmentModel.create({
      ...data,
      clientId: data.clientId || location.clientId,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });
    return equipment.toObject();
  }

  async findById(id: string, tenantId: string): Promise<IEquipment | null> {
    return EquipmentModel.findOne({ _id: id, tenantId, deletedAt: null })
      
      .exec() as unknown as Promise<IEquipment | null>;
  }

  async findByClient(
    clientId: string,
    tenantId: string
  ): Promise<IEquipment[]> {
    return EquipmentModel.find({ clientId, tenantId, deletedAt: null })
      .sort({ createdAt: -1 })
      
      .exec() as unknown as Promise<IEquipment[]>;
  }

  async findByLocation(
    locationId: string,
    tenantId: string
  ): Promise<IEquipment[]> {
    return EquipmentModel.find({ locationId, tenantId, deletedAt: null })
      .sort({ createdAt: -1 })
      
      .exec() as unknown as Promise<IEquipment[]>;
  }

  async update(
    id: string,
    data: UpdateEquipmentInput & { locationId?: string; clientId?: string },
    tenantId: string,
    userId: string
  ): Promise<IEquipment | null> {
    // If locationId changed, re-resolve clientId from new location
    if (data.locationId) {
      const location = await LocationModel.findOne({
        _id: data.locationId,
        tenantId,
        deletedAt: null,
      })
        .select('clientId')
        
        .exec();

      if (!location) {
        throw new Error(`Location ${data.locationId} not found or is deleted`);
      }

      data.clientId = location.clientId.toString();
    }

    return EquipmentModel.findOneAndUpdate(
      { _id: id, tenantId, deletedAt: null },
      { $set: { ...data, updatedBy: userId } },
      { new: true }
    )
      
      .exec() as unknown as Promise<IEquipment | null>;
  }

  async softDelete(id: string, tenantId: string, userId: string): Promise<void> {
    await EquipmentModel.updateOne(
      { _id: id, tenantId },
      { $set: { deletedAt: new Date(), deletedBy: userId } }
    );
  }
}
