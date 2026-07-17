import { Types } from 'mongoose';
import { NegotiationModel } from '../models';
import { ActivityService } from '../../crm/services/activity.service';
import { EVENT_TYPES } from '../../activity/types/activity';
import type {
  INegotiation,
  NegotiationStatus,
  FollowUpPriority,
} from '../types/negotiation';

export interface UpdateFollowUpInput {
  nextContactDate?: Date;
  assignedTo?: string;
  priority?: FollowUpPriority;
  internalNotes?: string;
}

export class FollowUpService {
  async updateFollowUp(
    negotiationId: string,
    data: UpdateFollowUpInput,
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
      throw new Error(`Cannot update followUp on negotiation in terminal status: ${currentStatus}`);
    }

    const followUpData: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: new Types.ObjectId(userId),
    };

    if (data.nextContactDate !== undefined) {
      followUpData.nextContactDate = data.nextContactDate;
    }
    if (data.assignedTo !== undefined) {
      followUpData.assignedTo = new Types.ObjectId(data.assignedTo);
    }
    if (data.priority !== undefined) {
      followUpData.priority = data.priority;
    }
    if (data.internalNotes !== undefined) {
      followUpData.internalNotes = data.internalNotes;
    }

    const updated = await NegotiationModel.findOneAndUpdate(
      { _id: negotiationId, tenantId, isDeleted: { $ne: true }, deletedAt: null },
      {
        $set: { followUp: followUpData, updatedBy: new Types.ObjectId(userId) },
      },
      { new: true },
    ).exec();

    if (!updated) {
      throw new Error('Failed to update followUp');
    }

    try {
      await new ActivityService().create({
        tenantId: new Types.ObjectId(tenantId),
        entityType: 'negotiation',
        entityId: new Types.ObjectId(negotiationId),
        activityType: 'follow_up' as const,
        title: 'Seguimiento actualizado',
        description: data.nextContactDate
          ? `Próximo contacto: ${data.nextContactDate.toLocaleDateString()}`
          : 'Seguimiento actualizado',
        performedBy: new Types.ObjectId(userId),
        metadata: {
          nextContactDate: data.nextContactDate,
          priority: data.priority,
          icon: 'calendar',
          color: 'purple',
          eventType: EVENT_TYPES.NEGOTIATION_FOLLOWUP_UPDATED,
          leadId: negotiation.leadId?.toString(),
        },
      }, tenantId);
    } catch (err) {
      console.error('[Activity] Failed to create activity:', err);
    }

    return updated.toObject();
  }
}
