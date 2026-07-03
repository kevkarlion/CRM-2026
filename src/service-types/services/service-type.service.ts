import ServiceTypeModel from '../models/service-type';
import { IServiceType, CreateServiceTypeInput, UpdateServiceTypeInput } from '../types/service-type';

export class ServiceTypeService {
  async create(
    data: CreateServiceTypeInput,
    tenantId: string
  ): Promise<IServiceType> {
    const serviceType = await ServiceTypeModel.create({
      ...data,
      tenantId,
      isActive: data.isActive ?? true,
    });
    return serviceType.toObject();
  }

  async findById(id: string, tenantId: string): Promise<IServiceType | null> {
    return ServiceTypeModel.findOne({ _id: id, tenantId, deletedAt: null })
      .exec() as unknown as Promise<IServiceType | null>;
  }

  async findByTenant(
    tenantId: string,
    includeInactive = false
  ): Promise<IServiceType[]> {
    const filter: Record<string, unknown> = { tenantId };
    if (!includeInactive) {
      filter.isActive = true;
    }
    return ServiceTypeModel.find(filter)
      .sort({ name: 1 })
      .exec() as unknown as Promise<IServiceType[]>;
  }

  async update(
    id: string,
    data: UpdateServiceTypeInput,
    tenantId: string
  ): Promise<IServiceType | null> {
    return ServiceTypeModel.findOneAndUpdate(
      { _id: id, tenantId, deletedAt: null },
      { $set: data },
      { new: true }
    )
      .exec() as unknown as Promise<IServiceType | null>;
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    await ServiceTypeModel.updateOne(
      { _id: id, tenantId },
      { $set: { deletedAt: new Date() } }
    );
  }

  async seedDefaults(tenantId: string): Promise<void> {
    const defaults = [
      { name: 'Instalación', description: 'Servicio de instalación de equipos y sistemas' },
      { name: 'Reparación', description: 'Servicio de reparación y solución de fallas' },
      { name: 'Mantenimiento', description: 'Servicio de mantenimiento preventivo y correctivo' },
      { name: 'Presupuesto', description: 'Elaboración de presupuesto técnico' },
    ];

    for (const service of defaults) {
      await ServiceTypeModel.updateOne(
        { tenantId, name: service.name },
        { $setOnInsert: { ...service, isActive: true } },
        { upsert: true }
      );
    }
  }
}
