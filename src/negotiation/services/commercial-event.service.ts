import { Types } from 'mongoose';
import { NegotiationModel } from '../models';
import { ActivityService } from '../../crm/services/activity.service';
import { EVENT_TYPES } from '../../crm/types/activity';
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
          tenantId: new Types.ObjectId(tenantId),
          entityType: 'negotiation',
          entityId: new Types.ObjectId(negotiationId),
          activityType: 'note' as const,
          title: eventTitles[data.eventType] || 'Evento comercial',
          description: data.description,
          performedBy: new Types.ObjectId(userId),
          metadata: { commercialEventType: data.eventType, icon: 'file-text', color: 'blue', eventType: EVENT_TYPES.NEGOTIATION_COMMERCIAL_EVENT, leadId: negotiation.leadId?.toString() },
        }, tenantId);
      } catch (err) {
        console.error('[Activity] Failed to create activity:', err);
      }
    }

    return updated.toObject();
  }
}
