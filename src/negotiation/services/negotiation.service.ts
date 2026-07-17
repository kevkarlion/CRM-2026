import { Types } from 'mongoose';
import { NegotiationModel, NegotiationEventModel } from '../models';
import { validateTransition, validateBusinessGuards } from './negotiation-state-machine';
import { ActivityService } from '../../crm/services/activity.service';
import { LeadService } from '../../leads/services/lead.service';
import { EVENT_TYPES } from '../../activity/types/activity';
import type {
  INegotiation,
  NegotiationStatus,
} from '../types/negotiation';

export class TransitionError extends Error {
  constructor(from: NegotiationStatus, to: NegotiationStatus, reason?: string) {
    super(reason || `Invalid transition from ${from} to ${to}`);
    this.name = 'TransitionError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export interface CreateNegotiationInput {
  leadId: string;
  quoteId?: string;
  discountAmount?: number;
  validUntil?: string;
  terms?: string;
}

export interface NegotiationFilters {
  status?: NegotiationStatus;
  leadId?: string;
  limit?: number;
}

export class NegotiationService {
  async create(
    data: CreateNegotiationInput,
    userId: string,
    tenantId: string,
  ): Promise<INegotiation> {
    const negotiation = await NegotiationModel.create({
      tenantId: new Types.ObjectId(tenantId),
      leadId: new Types.ObjectId(data.leadId),
      quoteId: data.quoteId ? new Types.ObjectId(data.quoteId) : undefined,
      discountAmount: data.discountAmount,
      validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
      terms: data.terms,
      status: 'open' as NegotiationStatus,
      counterOffers: [],
      commercialEvents: [],
      followUp: null,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    await NegotiationEventModel.create({
      tenantId: new Types.ObjectId(tenantId),
      negotiationId: negotiation._id,
      fromStatus: 'open' as NegotiationStatus,
      toStatus: 'open' as NegotiationStatus,
      changedBy: new Types.ObjectId(userId),
      changedAt: new Date(),
      reason: 'Negotiation created',
    });

    try {
      await new ActivityService().create({
        tenantId: new Types.ObjectId(tenantId),
        entityType: 'negotiation',
        entityId: new Types.ObjectId(negotiation._id),
        activityType: 'note' as const,
        title: 'Negociación iniciada',
        description: 'Negociación iniciada con el lead',
        performedBy: new Types.ObjectId(userId),
        metadata: { icon: 'handshake', color: 'blue', eventType: EVENT_TYPES.NEGOTIATION_CREATED, leadId: data.leadId },
      }, tenantId);
    } catch (err) {
      console.error('[Activity] Failed to create activity:', err);
    }

    if (data.quoteId) {
      try {
        const leadService = new LeadService();
        await leadService.changeStatus(data.leadId, 'negotiation', userId, tenantId);
      } catch (err) {
        console.error('[Lead] Failed to update lead status to negotiation:', err);
      }
    }

    return negotiation.toObject();
  }

  async findById(id: string, tenantId: string): Promise<INegotiation | null> {
    return NegotiationModel.findOne({ _id: id, tenantId, isDeleted: { $ne: true }, deletedAt: null })
      .exec();
  }

  async findByTenant(
    tenantId: string,
    filters: NegotiationFilters = {},
  ): Promise<INegotiation[]> {
    const query: Record<string, unknown> = { tenantId, isDeleted: { $ne: true }, deletedAt: null };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.leadId) {
      query.leadId = new Types.ObjectId(filters.leadId);
    }

    let queryBuilder = NegotiationModel.find(query)
      .populate('leadId', 'name companyName')
      .sort({ createdAt: -1 });

    if (filters.limit) {
      queryBuilder = queryBuilder.limit(filters.limit);
    }

    return queryBuilder.exec();
  }

  async addCounteroffer(
    id: string,
    counteroffer: { amount: number; terms: string; validUntil: string },
    userId: string,
    tenantId: string,
  ): Promise<INegotiation | null> {
    const { CounterOfferService } = await import('./counter-offer.service');
    const service = new CounterOfferService();
    try {
      return await service.addCounterOffer(
        id,
        {
          amount: counteroffer.amount,
          terms: counteroffer.terms,
          validUntil: new Date(counteroffer.validUntil),
        },
        userId,
        tenantId,
      );
    } catch {
      return null;
    }
  }

  async updateStatus(
    id: string,
    newStatus: NegotiationStatus,
    userId: string,
    tenantId: string,
    reason?: string,
  ): Promise<INegotiation | null> {
    const negotiation = await this.findById(id, tenantId);
    if (!negotiation) return null;

    const currentStatus = negotiation.status as NegotiationStatus;
    if (!validateTransition(currentStatus, newStatus)) {
      throw new TransitionError(currentStatus, newStatus);
    }

    const guardResult = validateBusinessGuards(negotiation, newStatus);
    if (!guardResult.valid) {
      throw new TransitionError(currentStatus, newStatus, guardResult.reason);
    }

    const previousStatus = currentStatus;

    const updated = await NegotiationModel.findOneAndUpdate(
      { _id: id, tenantId, isDeleted: { $ne: true }, deletedAt: null },
      { $set: { status: newStatus, updatedBy: new Types.ObjectId(userId) } },
      { new: true },
    ).exec();

    if (!updated) return null;

    await NegotiationEventModel.create({
      tenantId: new Types.ObjectId(tenantId),
      negotiationId: new Types.ObjectId(id),
      fromStatus: currentStatus,
      toStatus: newStatus,
      changedBy: new Types.ObjectId(userId),
      changedAt: new Date(),
      reason,
    });

    const activityTypes: Record<string, { type: string; title: string; icon: string; color: string }> = {
      accepted: {
        type: EVENT_TYPES.NEGOTIATION_CLOSED_WON,
        title: 'Negociación cerrada — Ganada',
        icon: 'trophy',
        color: 'green',
      },
      rejected: {
        type: EVENT_TYPES.NEGOTIATION_CLOSED_LOST,
        title: 'Negociación cerrada — Perdida',
        icon: 'frown',
        color: 'red',
      },
      expired: {
        type: EVENT_TYPES.NEGOTIATION_STATUS_CHANGED,
        title: 'Negociación expirada',
        icon: 'clock',
        color: 'purple',
      },
    };

    const activityConfig = activityTypes[newStatus];
    if (activityConfig) {
      try {
        await new ActivityService().create({
          tenantId: new Types.ObjectId(tenantId),
          entityType: 'negotiation',
          entityId: new Types.ObjectId(id),
          activityType: 'status_change' as const,
          title: activityConfig.title,
          description: `Negociación cambió de ${currentStatus} a ${newStatus}`,
          performedBy: new Types.ObjectId(userId),
          metadata: { from: currentStatus, to: newStatus, icon: activityConfig.icon, color: activityConfig.color, eventType: activityConfig.type, leadId: negotiation.leadId?.toString() },
        }, tenantId);
      } catch (err) {
        console.error('[Activity] Failed to create activity:', err);
      }
    }

    if (newStatus === 'accepted' || newStatus === 'rejected') {
      try {
        const leadService = new LeadService();
        const leadStatus = newStatus === 'accepted' ? 'won' : 'lost';
        await leadService.changeStatus(negotiation.leadId.toString(), leadStatus, userId, tenantId);
      } catch (err) {
        console.error('[Lead] Failed to update lead status, compensating:', err);
        try {
          await NegotiationModel.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: { status: previousStatus, updatedBy: new Types.ObjectId(userId) } },
            { new: true },
          ).exec();
          console.log(`[Negotiation] Compensated status back to ${previousStatus}`);
        } catch (compensationErr) {
          console.error('[Negotiation] Compensation failed:', compensationErr);
        }
      }
    }

    return updated;
  }

  async softDelete(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<boolean> {
    const updated = await NegotiationModel.findOneAndUpdate(
      { _id: id, tenantId, isDeleted: { $ne: true }, deletedAt: null },
      { $set: { deletedAt: new Date(), deletedBy: new Types.ObjectId(userId), isDeleted: true } },
      { new: true },
    ).exec();

    return !!updated;
  }

  async checkAndExpireOverdue(tenantId: string, userId: string): Promise<number> {
    const now = new Date();
    const overdue = await NegotiationModel.find({
      tenantId: new Types.ObjectId(tenantId),
      status: { $in: ['open' as NegotiationStatus, 'counteroffer_made' as NegotiationStatus] },
      validUntil: { $lt: now, $ne: null },
      isDeleted: { $ne: true },
      deletedAt: null,
    }).exec();

    let expiredCount = 0;
    for (const negotiation of overdue) {
      const currentStatus = negotiation.status as NegotiationStatus;
      await NegotiationModel.findOneAndUpdate(
        { _id: negotiation._id, tenantId: new Types.ObjectId(tenantId) },
        {
          $set: { status: 'expired' as NegotiationStatus, updatedBy: new Types.ObjectId(userId) },
        },
        { new: true },
      ).exec();

      await NegotiationEventModel.create({
        tenantId: new Types.ObjectId(tenantId),
        negotiationId: negotiation._id,
        fromStatus: currentStatus,
        toStatus: 'expired' as NegotiationStatus,
        changedBy: new Types.ObjectId(userId),
        changedAt: now,
        reason: 'Automatically expired — validUntil passed',
      });

      expiredCount++;
    }

    return expiredCount;
  }

  static async checkExpiredAndUpdate(tenantId: string, userId: string): Promise<number> {
    const service = new NegotiationService();
    return service.checkAndExpireOverdue(tenantId, userId);
  }
}
