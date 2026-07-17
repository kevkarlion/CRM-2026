import { Types } from 'mongoose';
import { NegotiationModel } from '../models';
import { ActivityService } from '../../activity/services/activity.service';
import { EVENT_TYPES } from '../../activity/types';
import type {
  INegotiation,
  NegotiationStatus,
  CommercialEventType,
} from '../types/negotiation';

export interface AddCommercialEventInput {
  eventType: CommercialEventType;
  description: string;
  createActivity?: boolean;
}

export class CommercialEventService {
  async addEvent(
    negotiationId: string,
    data: AddCommercialEventInput,
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
      throw new Error(`Cannot add commercial event to negotiation in terminal status: ${currentStatus}`);
    }

    const commercialEvent = {
      eventType: data.eventType,
      description: data.description,
      createdBy: new Types.ObjectId(userId),
      createdAt: new Date(),
    };

    const updated = await NegotiationModel.findOneAndUpdate(
      { _id: negotiationId, tenantId, isDeleted: { $ne: true }, deletedAt: null },
      {
        $push: { commercialEvents: commercialEvent },
        $set: { updatedBy: new Types.ObjectId(userId) },
      },
      { new: true },
    ).exec();

    if (!updated) {
      throw new Error('Failed to update negotiation');
    }

    if (data.createActivity) {
      try {
        const eventTitles: Record<string, string> = {
          discount_request: 'Solicitud de descuento',
          financing_request: 'Solicitud de financiamiento',
          scope_change: 'Cambio de alcance',
          needs_time: 'Necesita tiempo',
          technical_query: 'Consulta técnica',
          new_visit_request: 'Solicitud de nueva visita',
          accepted_conditions: 'Condiciones aceptadas',
          rejected_conditions: 'Condiciones rechazadas',
          other: 'Otro evento comercial',
        };

        await new ActivityService().create({
          tenantId,
          leadId: negotiation.leadId?.toString(),
          entityType: 'negotiation',
          entityId: negotiationId,
          eventType: EVENT_TYPES.NEGOTIATION_COMMERCIAL_EVENT,
          title: eventTitles[data.eventType] || 'Evento comercial',
          summary: data.description,
          icon: 'file-text',
          color: 'blue',
          metadata: { eventType: data.eventType },
        }, userId);
      } catch (err) {
        console.error('[Activity] Failed to create activity:', err);
      }
    }

    return updated.toObject();
  }
}
