import mongoose, { Types } from 'mongoose';
import { TechnicalVisitModel } from '../models/technical-visit';
import type { ITechnicalVisit } from '../schemas/technical-visit';
import { ValidationError } from '@/core/errors';
import { eventBus } from '@/infrastructure/events/event-bus';
import { DOMAIN_EVENTS, VisitCreatedPayload, VisitStatusChangedPayload, VisitCompletedPayload } from '@/infrastructure/events/event.types';

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
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const tenantPrefix = tenantId.toString().slice(-6);
      const count = await TechnicalVisitModel.countDocuments({ tenantId: new Types.ObjectId(tenantId) }).session(session);
      const visitNumber = `VT-${tenantPrefix}-${String(count + 1).padStart(4, '0')}`;
      
      const [visit] = await TechnicalVisitModel.create([{
        ...data,
        tenantId: new Types.ObjectId(tenantId),
        visitNumber,
        status: 'draft',
        createdBy: new Types.ObjectId(userId),
        updatedBy: new Types.ObjectId(userId),
      }], { session });

      await session.commitTransaction();

      try {
        await eventBus.publish({
          type: DOMAIN_EVENTS.VISIT_CREATED,
          aggregateId: visit._id.toString(),
          aggregateType: 'TechnicalVisit',
          tenantId,
          userId,
          timestamp: new Date(),
          payload: {
            visitId: visit._id.toString(),
            leadId: data.leadId?.toString() || null,
            number: visitNumber,
            title: data.title,
            scheduledDate: data.scheduledDate?.toISOString(),
            scheduledTime: data.scheduledStart
              ? `${String(data.scheduledStart.getHours()).padStart(2, '0')}:${String(data.scheduledStart.getMinutes()).padStart(2, '0')}`
              : undefined,
            category: data.category,
            priority: data.priority,
            address: data.locationSnapshot?.address,
          } as VisitCreatedPayload,
        });
      } catch (eventError) {
        console.error('[TechnicalVisitService] Failed to publish VISIT_CREATED:', eventError);
      }

      return visit.toObject();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async update(id: string, data: Partial<ITechnicalVisit>, tenantId: string, userId: string): Promise<ITechnicalVisit | null> {
    return TechnicalVisitModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
      { $set: { ...data, updatedBy: new Types.ObjectId(userId) } },
      { new: true }
    ).lean();
  }

  async updateStatus(id: string, status: string, tenantId: string, userId: string): Promise<ITechnicalVisit | null> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const current = await TechnicalVisitModel.findOne({
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      }).session(session).lean();

      if (!current) {
        await session.abortTransaction();
        session.endSession();
        return null;
      }

      const previousStatus = (current as any).status;

      const visit = await TechnicalVisitModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
        { $set: { status: status as any, updatedBy: new Types.ObjectId(userId) } },
        { new: true }
      ).session(session).lean();

      await session.commitTransaction();

      try {
        await eventBus.publish({
          type: DOMAIN_EVENTS.VISIT_STATUS_CHANGED,
          aggregateId: id,
          aggregateType: 'TechnicalVisit',
          tenantId,
          userId,
          timestamp: new Date(),
          payload: {
            visitId: id,
            from: previousStatus,
            to: status,
            number: (current as any).visitNumber,
            title: (current as any).title,
          } as VisitStatusChangedPayload,
        });

        // Also publish VISIT_COMPLETED when status is completed
        if (status === 'completed') {
          await eventBus.publish({
            type: DOMAIN_EVENTS.VISIT_COMPLETED,
            aggregateId: id,
            aggregateType: 'TechnicalVisit',
            tenantId,
            userId,
            timestamp: new Date(),
            payload: {
              visitId: id,
              number: (current as any).visitNumber,
            } as VisitCompletedPayload,
          });
        }
      } catch (eventError) {
        console.error('[TechnicalVisitService] Failed to publish VISIT_STATUS_CHANGED:', eventError);
      }

      return visit;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
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