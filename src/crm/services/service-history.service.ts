import { ServiceHistoryModel } from '../models';
import { IServiceHistory, CreateServiceHistoryInput } from '../types/service-history';
import { cursorPage } from '../helpers/cursor-pagination';
import { CursorPage, CursorOptions } from '../types/common';

export class ServiceHistoryService {
  async create(
    data: CreateServiceHistoryInput,
    tenantId: string,
    userId: string
  ): Promise<IServiceHistory> {
    const record = await ServiceHistoryModel.create({
      ...data,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });
    return record.toObject();
  }

  async findById(id: string, tenantId: string): Promise<IServiceHistory | null> {
    return ServiceHistoryModel.findOne({ _id: id, tenantId, deletedAt: null })
      
      .exec() as unknown as Promise<IServiceHistory | null>;
  }

  async findByEquipment(
    equipmentId: string,
    tenantId: string,
    options?: Partial<CursorOptions>
  ): Promise<CursorPage<IServiceHistory>> {
    return cursorPage<IServiceHistory>(
      ServiceHistoryModel,
      { equipmentId, tenantId, deletedAt: null },
      {
        limit: options?.limit || 20,
        cursor: options?.cursor,
        sortField: 'serviceDate',
        sortOrder: -1,
      }
    );
  }

  async findByPerformer(
    performedBy: string,
    tenantId: string,
    options?: Partial<CursorOptions>
  ): Promise<CursorPage<IServiceHistory>> {
    return cursorPage<IServiceHistory>(
      ServiceHistoryModel,
      { performedBy, tenantId, deletedAt: null },
      {
        limit: options?.limit || 20,
        cursor: options?.cursor,
        sortField: 'serviceDate',
        sortOrder: -1,
      }
    );
  }
}
