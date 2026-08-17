import mongoose, { Types } from 'mongoose';
import { GestionModel } from '../models';
import { logActivity } from '../../audit/activity-logger';
import ClientModel from '../../crm/models/client';
import { cursorPage } from '../../crm/helpers/cursor-pagination';
import type { IGestion, GestionStatus, CreateGestionInput, UpdateGestionInput, LostReason } from '../types/gestion';
import { eventBus } from '@/infrastructure/events/event-bus';
import { DOMAIN_EVENTS, GestionCreatedPayload, GestionStatusChangedPayload } from '@/infrastructure/events/event.types';

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface GestionListFilters {
  status?: GestionStatus;
  clientId?: string;
  assignedTo?: string;
  source?: string;
  createdAtGte?: string;
  createdAtLte?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface GestionListResult {
  data: IGestion[];
  cursor?: string;
  total: number;
}

export class GestionService {
  async createGestion(
    data: CreateGestionInput,
    userId: string,
    tenantId: string,
  ): Promise<IGestion> {
    const { assignedTo, status, lostReason, lostDescription, ...gestionData } = data;
    const resolvedStatus: GestionStatus = status || 'new';

    const validLostReasons: LostReason[] = ['price', 'competitor', 'budget', 'not_interested', 'timing', 'no_response', 'other'];
    if (resolvedStatus === 'lost' && !lostReason) {
      throw new ValidationError('lostReason is required when status is lost');
    }
    if (lostReason && !validLostReasons.includes(lostReason)) {
      throw new ValidationError('Invalid lostReason value');
    }

    // Check if client has reached max active Gestiones (max 3 allowed)
    const activeCount = await GestionModel.countDocuments({
      tenantId: new Types.ObjectId(tenantId),
      clientId: new Types.ObjectId(data.clientId),
      status: { $nin: ['won', 'lost'] },
      deletedAt: null,
    });

    if (activeCount >= 3) {
      throw new ConflictError('Client has maximum active Gestiones (3)');
    }

    const gestion = await GestionModel.create({
      ...gestionData,
      clientId: new Types.ObjectId(data.clientId),
      status: resolvedStatus,
      createdBy: userId,
      updatedBy: userId,
      tenantId: new Types.ObjectId(tenantId),
    });

    try {
      await eventBus.publish({
        type: DOMAIN_EVENTS.GESTION_CREATED,
        aggregateId: String(gestion._id),
        aggregateType: 'Gestion',
        tenantId,
        userId,
        timestamp: new Date(),
        payload: {
          gestionId: String(gestion._id),
          clientId: data.clientId,
          name: gestion.name,
          source: gestion.source || 'unknown',
        } as GestionCreatedPayload,
      });
    } catch (eventError) {
      console.error('[GestionService] Failed to publish GESTION_CREATED:', eventError);
    }

    // Handle terminal statuses on creation
    if (resolvedStatus === 'lost') {
      await GestionModel.findOneAndUpdate(
        { _id: gestion._id },
        {
          $set: {
            lostReason,
            ...(lostDescription && { lostDescription }),
            qualificationStatus: 'not_qualified',
          },
        },
      ).exec();
    }

    const refreshedGestion = await GestionModel.findOne({ _id: gestion._id }).exec();
    return (refreshedGestion || gestion).toObject() as unknown as IGestion;
  }

  async listGestiones(
    filters: GestionListFilters,
    tenantId: string,
  ): Promise<GestionListResult> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    };

    if (filters.status) {
      filter.status = filters.status;
    }

    if (filters.clientId) {
      filter.clientId = new Types.ObjectId(filters.clientId);
    }

    if (filters.assignedTo) {
      filter.assignedTo = new Types.ObjectId(filters.assignedTo);
    }

    if (filters.source) {
      filter.source = filters.source;
    }

    if (filters.createdAtGte || filters.createdAtLte) {
      const createdAtFilter: Record<string, unknown> = {};
      if (filters.createdAtGte) {
        createdAtFilter.$gte = new Date(filters.createdAtGte);
      }
      if (filters.createdAtLte) {
        createdAtFilter.$lte = new Date(filters.createdAtLte);
      }
      filter.createdAt = createdAtFilter;
    }

    if (filters.search) {
      const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { companyName: { $regex: escaped, $options: 'i' } },
      ];
    }

    const total = await GestionModel.countDocuments(filter).exec();

    const page = await cursorPage(GestionModel, filter, {
      limit: filters.limit || 20,
      cursor: filters.cursor,
      sort: { createdAt: -1 },
      populate: [
        { path: 'clientId', select: 'fullName companyName email phone' },
        { path: 'assignedTo', select: 'name email' },
      ],
    } as never);

    return {
      data: page.data as unknown as IGestion[],
      cursor: page.cursor ?? undefined,
      total,
    };
  }

  async getGestion(
    gestionId: string,
    tenantId: string,
  ): Promise<IGestion | null> {
    const gestion = await GestionModel.findOne({
      _id: new Types.ObjectId(gestionId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    })
      .populate('clientId', 'fullName companyName email phone')
      .populate('assignedTo', 'name email')
      .exec();

    return gestion as unknown as IGestion | null;
  }

  async updateGestion(
    gestionId: string,
    data: UpdateGestionInput,
    userId: string,
    tenantId: string,
  ): Promise<IGestion | null> {
    if ((data as Record<string, unknown>).status) {
      throw new ValidationError('Cannot change status via update. Use changeStatus instead.');
    }

    const { assignedTo, ...updateData } = data;

    const updatedGestion = await GestionModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(gestionId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      },
      { $set: { ...updateData, updatedBy: userId } },
      { new: true },
    )
      .populate('clientId', 'fullName companyName email phone')
      .populate('assignedTo', 'name email')
      .exec();

    if (!updatedGestion) return null;

    await logActivity({
      tenantId,
      entityType: 'gestion',
      entityId: gestionId,
      action: 'updated',
      actorId: userId,
      changes: { after: updateData as Record<string, unknown> },
    });

    return updatedGestion as unknown as IGestion;
  }

  async changeStatus(
    gestionId: string,
    newStatus: GestionStatus,
    userId: string,
    tenantId: string,
  ): Promise<IGestion> {
    const gestion = await GestionModel.findOne({
      _id: new Types.ObjectId(gestionId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    })
      .populate('clientId', 'fullName')
      .exec();

    if (!gestion) {
      throw new Error('Gestion not found');
    }

    const currentStatus = gestion.status as GestionStatus;

    const updatedGestion = await GestionModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(gestionId),
        tenantId: new Types.ObjectId(tenantId),
        status: currentStatus,
        deletedAt: null,
      },
      { $set: { status: newStatus, updatedBy: userId } },
      { new: true },
    )
      .populate('clientId', 'fullName companyName email phone')
      .populate('assignedTo', 'name email')
      .exec();

    if (!updatedGestion) {
      throw new ConflictError('Cannot change status, concurrent modification');
    }

    // Handle status "won" → update Client.operationStatus to "sale_confirmed"
    if (newStatus === 'won') {
      try {
        await ClientModel.findOneAndUpdate(
          { _id: gestion.clientId, tenantId: new Types.ObjectId(tenantId), deletedAt: null },
          {
            $set: {
              operationStatus: 'sale_confirmed',
              operationStatusUpdatedAt: new Date(),
            },
          },
        ).exec();
      } catch (clientError) {
        console.error('[GestionService] Failed to update client operationStatus:', clientError);
      }
    }

    // Handle status "lost" → update qualificationStatus
    if (newStatus === 'lost') {
      await GestionModel.findOneAndUpdate(
        { _id: new Types.ObjectId(gestionId) },
        { $set: { qualificationStatus: 'not_qualified' } },
      ).exec();
    }

    try {
      await eventBus.publish({
        type: DOMAIN_EVENTS.GESTION_STATUS_CHANGED,
        aggregateId: gestionId,
        aggregateType: 'Gestion',
        tenantId,
        userId,
        timestamp: new Date(),
        payload: {
          gestionId,
          clientId: String(gestion.clientId),
          from: currentStatus,
          to: newStatus,
          gestionName: gestion.name,
        } as GestionStatusChangedPayload,
      });
    } catch (eventError) {
      console.error('[GestionService] Failed to publish GESTION_STATUS_CHANGED:', eventError);
    }

    return updatedGestion as unknown as IGestion;
  }

  async softDelete(
    gestionId: string,
    userId: string,
    tenantId: string,
  ): Promise<IGestion | null> {
    const gestion = await GestionModel.findOne({
      _id: new Types.ObjectId(gestionId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    }).exec();

    if (!gestion) return null;

    if (gestion.status === 'won') {
      throw new ValidationError('Cannot delete a Gestion that is marked as won');
    }

    const updatedGestion = await GestionModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(gestionId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      },
      { $set: { deletedAt: new Date(), deletedBy: userId } },
      { new: true },
    )
      .populate('clientId', 'fullName companyName email phone')
      .populate('assignedTo', 'name email')
      .exec();

    if (!updatedGestion) return null;

    await logActivity({
      tenantId,
      entityType: 'gestion',
      entityId: gestionId,
      action: 'deleted',
      actorId: userId,
    });

    return updatedGestion as unknown as IGestion;
  }

  async getActiveGestionByClient(
    clientId: string,
    tenantId: string,
  ): Promise<IGestion | null> {
    const gestion = await GestionModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      clientId: new Types.ObjectId(clientId),
      status: { $nin: ['won', 'lost'] },
      deletedAt: null,
    })
      .populate('clientId', 'fullName companyName email phone')
      .populate('assignedTo', 'name email')
      .exec();

    return gestion as unknown as IGestion | null;
  }

  async getGestionById(
    gestionId: string,
    tenantId: string,
  ): Promise<IGestion | null> {
    const gestion = await GestionModel.findOne({
      _id: new Types.ObjectId(gestionId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    })
      .populate('clientId', 'fullName companyName email phone')
      .populate('assignedTo', 'name email')
      .exec();

    return gestion as unknown as IGestion | null;
  }
}