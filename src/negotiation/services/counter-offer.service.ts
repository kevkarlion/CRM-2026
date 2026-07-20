import { Types } from 'mongoose';
import { NegotiationModel, NegotiationEventModel } from '../models';
import { validateTransition, validateBusinessGuards } from './negotiation-state-machine';
import { ActivityService } from '../../crm/services/activity.service';
import { EVENT_TYPES } from '../../crm/types/activity';
import type {
  INegotiation,
  NegotiationStatus,
  CounterOffer,
} from '../types/negotiation';

const TERMINAL_COUNTEROFFER_STATUSES = ['accepted', 'rejected', 'expired', 'cancelled'] as const;

export class CounterOfferNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CounterOfferNotFoundError';
  }
}

export class CounterOfferTerminalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CounterOfferTerminalError';
  }
}

export interface AddCounterOfferInput {
  amount: number;
  discountFixed?: number;
  discountPercent?: number;
  reason?: string;
  internalNotes?: string;
  validUntil: Date;
  terms: string;
}

export class CounterOfferService {
  async addCounterOffer(
    negotiationId: string,
    data: AddCounterOfferInput,
    userId: string,
    tenantId: string,
  ): Promise<INegotiation> {
    const negotiation = await NegotiationModel.findOne({
      _id: negotiationId,
      tenantId,
      isDeleted: { $ne: true },
      deletedAt: null,
    }).exec();

    if (!negotiation) {
      throw new Error('Negotiation not found');
    }

    const currentStatus = negotiation.status as NegotiationStatus;
    if (currentStatus === 'accepted' || currentStatus === 'rejected' || currentStatus === 'expired') {
      throw new Error(`Cannot add counteroffer to negotiation in terminal status: ${currentStatus}`);
    }

    const counterOfferDoc: CounterOffer = {
      amount: data.amount,
      discountFixed: data.discountFixed,
      discountPercent: data.discountPercent,
      terms: data.terms,
      reason: data.reason,
      internalNotes: data.internalNotes,
      createdBy: new Types.ObjectId(userId),
      validUntil: data.validUntil,
      status: 'pending',
      createdAt: new Date(),
    };

    const shouldTransition = currentStatus === 'open';
    const setStatus: Record<string, unknown> = {
      updatedBy: new Types.ObjectId(userId),
    };

    if (shouldTransition) {
      setStatus.status = 'counteroffer_made' as NegotiationStatus;
    }

    const updated = await NegotiationModel.findOneAndUpdate(
      { _id: negotiationId, tenantId, isDeleted: { $ne: true }, deletedAt: null },
      {
        $push: { counterOffers: counterOfferDoc },
        $set: setStatus,
      },
      { new: true },
    ).exec();

    if (!updated) {
      throw new Error('Failed to update negotiation');
    }

    if (shouldTransition) {
      await NegotiationEventModel.create({
        tenantId: new Types.ObjectId(tenantId),
        negotiationId: new Types.ObjectId(negotiationId),
        fromStatus: currentStatus,
        toStatus: 'counteroffer_made' as NegotiationStatus,
        changedBy: new Types.ObjectId(userId),
        changedAt: new Date(),
        reason: 'Counteroffer added',
      });
    }

    try {
      await new ActivityService().create({
        tenantId: new Types.ObjectId(tenantId),
        entityType: 'negotiation',
        entityId: new Types.ObjectId(negotiationId),
        activityType: 'note' as const,
        title: 'Contraoferta registrada',
        description: `Contraoferta de $${data.amount} registrada`,
        performedBy: new Types.ObjectId(userId),
        metadata: { amount: data.amount, icon: 'repeat', color: 'orange', eventType: EVENT_TYPES.NEGOTIATION_COUNTEROFFER, leadId: negotiation.leadId?.toString() },
      }, tenantId);
    } catch (err) {
      console.error('[Activity] Failed to create activity:', err);
    }

    return updated.toObject();
  }

  async updateCounterOfferStatus(
    negotiationId: string,
    counterOfferIndex: number,
    newStatus: 'accepted' | 'rejected' | 'expired' | 'cancelled',
    userId: string,
    tenantId: string,
  ): Promise<INegotiation> {
    const negotiation = await NegotiationModel.findOne({
      _id: negotiationId,
      tenantId,
      isDeleted: { $ne: true },
      deletedAt: null,
    }).exec();

    if (!negotiation) {
      throw new Error('Negotiation not found');
    }

    if (counterOfferIndex < 0 || counterOfferIndex >= negotiation.counterOffers.length) {
      throw new CounterOfferNotFoundError('Counteroffer index out of bounds');
    }

    const counterOffer = negotiation.counterOffers[counterOfferIndex];

    if ((TERMINAL_COUNTEROFFER_STATUSES as readonly string[]).includes(counterOffer.status)) {
      throw new CounterOfferTerminalError('Cannot update counteroffer in terminal status');
    }

    const now = new Date();
    const updated = await NegotiationModel.findOneAndUpdate(
      {
        _id: negotiationId,
        tenantId,
        isDeleted: { $ne: true },
        deletedAt: null,
      },
      {
        $set: {
          [`counterOffers.${counterOfferIndex}.status`]: newStatus,
          [`counterOffers.${counterOfferIndex}.respondedAt`]: now,
          updatedBy: new Types.ObjectId(userId),
        },
      },
      { new: true },
    ).exec();

    if (!updated) {
      throw new Error('Failed to update counteroffer');
    }

    const statusIcons: Record<string, string> = {
      accepted: 'check-circle',
      rejected: 'x-circle',
      expired: 'clock',
      cancelled: 'x-circle',
    };

    const statusColors: Record<string, string> = {
      accepted: 'green',
      rejected: 'red',
      expired: 'yellow',
      cancelled: 'gray',
    };

    try {
      await new ActivityService().create({
        tenantId: new Types.ObjectId(tenantId),
        entityType: 'negotiation',
        entityId: new Types.ObjectId(negotiationId),
        activityType: 'note' as const,
        title: `Contraoferta ${newStatus}`,
        description: `Contraoferta cambiada a ${newStatus}`,
        performedBy: new Types.ObjectId(userId),
        metadata: { counterOfferIndex, newStatus, icon: statusIcons[newStatus] || 'check-circle', color: statusColors[newStatus] || 'blue', eventType: EVENT_TYPES.NEGOTIATION_COUNTEROFFER_STATUS_CHANGED, leadId: negotiation.leadId?.toString() },
      }, tenantId);
    } catch (err) {
      console.error('[Activity] Failed to create activity:', err);
    }

    return updated.toObject();
  }
}
