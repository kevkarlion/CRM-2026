import { Types } from 'mongoose';
import { TechnicalVisitModel } from '../models/technical-visit';
import type { ITechnicalVisit } from '../schemas/technical-visit';
import { ValidationError } from '@/core/errors';

export class TechnicalVisitService {
  async findByTenant(tenantId: string, filters: Record<string, unknown> = {}) {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
    };
    
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    if (filters.leadId) query.leadId = new Types.ObjectId(filters.leadId as string);
    
    if (filters.scheduledDateGte || filters.scheduledDateLte) {
      query.scheduledDate = { $gte: filters.scheduledDateGte as Date, $lte: filters.scheduledDateLte as Date } as any;
    }
    
    return TechnicalVisitModel.find(query).sort({ createdAt: -1 }).lean();
  }

  async findById(id: string, tenantId: string): Promise<ITechnicalVisit | null> {
    return TechnicalVisitModel.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    }).lean();
  }

  async create(data: Partial<ITechnicalVisit>, tenantId: string, userId: string): Promise<ITechnicalVisit> {
    const tenantPrefix = tenantId.toString().slice(-6);
    const count = await TechnicalVisitModel.countDocuments({ tenantId: new Types.ObjectId(tenantId) });
    const visitNumber = `VT-${tenantPrefix}-${String(count + 1).padStart(4, '0')}`;
    
    const visit = await TechnicalVisitModel.create({
      ...data,
      tenantId: new Types.ObjectId(tenantId),
      visitNumber,
      status: 'draft',
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });
    
    return visit.toObject();
  }

  async update(id: string, data: Partial<ITechnicalVisit>, tenantId: string, userId: string): Promise<ITechnicalVisit | null> {
    return TechnicalVisitModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
      { $set: { ...data, updatedBy: new Types.ObjectId(userId) } },
      { new: true }
    ).lean();
  }

  async updateStatus(id: string, status: string, tenantId: string, userId: string): Promise<ITechnicalVisit | null> {
    return TechnicalVisitModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
      { $set: { status: status as any, updatedBy: new Types.ObjectId(userId) } },
      { new: true }
    ).lean();
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await TechnicalVisitModel.deleteOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    });
    return result.deletedCount > 0;
  }
}

export const technicalVisitService = new TechnicalVisitService();