import mongoose, { Types } from 'mongoose';
import LeadModel from '../models/lead';
import { LeadAssignmentService } from './lead-assignment.service';
import { validateTransition, TransitionError } from '../helpers/lead-state-machine';
import { findDuplicates } from '../helpers/duplicate-detection';
import { logActivity } from '../../audit/activity-logger';
import ActivityModel from '../../crm/models/activity';
import ClientModel from '../../crm/models/client';
import ContactModel from '../../crm/models/contact';
import ConversationModel from '../../conversation/models/conversation';
import WhatsAppMessageModel from '../../crm/models/whatsapp-message';
import { cursorPage } from '../../crm/helpers/cursor-pagination';
import type { ILead, LeadStatus, CreateLeadInput, UpdateLeadInput, LostReason } from '../types/lead';
import type { IPipeline, IPipelineStage } from '../types/pipeline';
import PipelineModel from '../models/pipeline';
import UserModel from '../../core/models/user';
import { TERMINAL_STATUSES } from '../helpers/lead-state-machine';
import { eventBus } from '@/infrastructure/events/event-bus';
import { DOMAIN_EVENTS, LeadCreatedPayload, LeadStatusChangedPayload, LeadConvertedPayload } from '@/infrastructure/events/event.types';

const assignmentService = new LeadAssignmentService();

export interface DuplicateWarning {
  leadId: string;
  matchedField: string;
  matchedValue: string;
}

export interface CreateLeadResult {
  lead: ILead;
  warnings?: DuplicateWarning[];
  nextAction: 'none' | 'create_quote' | 'schedule_visit';
}

export interface LeadListFilters {
  status?: LeadStatus;
  assignedTo?: string;
  source?: string;
  createdAtGte?: string;
  createdAtLte?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface LeadListResult {
  data: ILead[];
  cursor?: string;
  total: number;
}

export interface GroupedFilters {
  assignedTo?: string;
  search?: string;
  createdAtGte?: string;
  createdAtLte?: string;
}

export interface GroupedResult {
  pipeline: IPipeline;
  groups: Record<string, { stage: IPipelineStage; leads: ILead[] }>;
  unmatched: ILead[];
  truncated: Record<string, boolean>;
}

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

export class LeadService {
  async createLead(
    data: CreateLeadInput,
    userId: string,
    tenantId: string,
  ): Promise<CreateLeadResult> {
    const warnings: DuplicateWarning[] = [];

    if (data.email || data.phone || data.companyName) {
      const duplicates = await findDuplicates(tenantId, data.email, data.companyName);
      for (const dup of duplicates) {
        const d = dup as Record<string, unknown>;
        if (data.email && String(d.email).toLowerCase() === data.email.toLowerCase()) {
          warnings.push({ leadId: String(d._id), matchedField: 'email', matchedValue: data.email });
        }
        if (data.phone && d.phone === data.phone) {
          warnings.push({ leadId: String(d._id), matchedField: 'phone', matchedValue: data.phone });
        }
        if (data.companyName && String(d.companyName).toLowerCase() === data.companyName.toLowerCase()) {
          warnings.push({ leadId: String(d._id), matchedField: 'companyName', matchedValue: data.companyName });
        }
      }
    }

    const { assignedTo, status, lostReason, lostDescription, ...leadData } = data;
    const resolvedStatus: LeadStatus = status || 'new';

    const validLostReasons: LostReason[] = ['price', 'competitor', 'budget', 'not_interested', 'timing', 'no_response', 'other'];
    if (resolvedStatus === 'lost' && !lostReason) {
      throw new ValidationError('lostReason is required when status is lost');
    }
    if (lostReason && !validLostReasons.includes(lostReason)) {
      throw new ValidationError('Invalid lostReason value');
    }

    const lead = await LeadModel.create({
      ...leadData,
      status: resolvedStatus,
      createdBy: userId,
      updatedBy: userId,
      tenantId: new Types.ObjectId(tenantId),
    });

    if (assignedTo) {
      await assignmentService.assign(String(lead._id), assignedTo, userId, tenantId);
    }

    try {
      await eventBus.publish({
        type: DOMAIN_EVENTS.LEAD_CREATED,
        aggregateId: String(lead._id),
        aggregateType: 'Lead',
        tenantId,
        userId,
        timestamp: new Date(),
        payload: {
          leadId: String(lead._id),
          name: lead.name,
          source: lead.source || 'unknown',
        } as LeadCreatedPayload,
      });
    } catch (eventError) {
      console.error('[LeadService] Failed to publish LEAD_CREATED:', eventError);
    }

    let nextAction: CreateLeadResult['nextAction'] = 'none';

    switch (resolvedStatus) {
      case 'won':
        await this.createClientFromLeadAndMarkWon(lead, userId, tenantId);
        nextAction = 'none';
        break;

      case 'lost':
        await LeadModel.findOneAndUpdate(
          { _id: lead._id },
          {
            $set: {
              lostReason,
              ...(lostDescription && { lostDescription }),
              qualificationStatus: 'not_qualified',
            },
          },
        ).exec();
        nextAction = 'none';
        break;

      case 'quote_sent':
        await LeadModel.findOneAndUpdate(
          { _id: lead._id },
          { $set: { qualificationStatus: 'qualified' } },
        ).exec();
        nextAction = 'create_quote';
        break;

      case 'technical_visit':
        await LeadModel.findOneAndUpdate(
          { _id: lead._id },
          { $set: { qualificationStatus: 'qualified' } },
        ).exec();
        nextAction = 'schedule_visit';
        break;

      default:
        break;
    }

    const refreshedLead = await LeadModel.findOne({ _id: lead._id }).exec();
    const result: CreateLeadResult = {
      lead: (refreshedLead || lead).toObject() as unknown as ILead,
      nextAction,
    };
    if (warnings.length > 0) {
      result.warnings = warnings;
    }
    return result;
  }

  private async createClientFromLead(
    lead: ILead,
    userId: string,
    session: mongoose.ClientSession,
  ): Promise<Types.ObjectId> {
    const nameParts = lead.name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    const [newClient] = await ClientModel.create([{
      tenantId: lead.tenantId,
      customerType: 'residential',
      status: 'active',
      fullName: lead.name,
      companyName: lead.companyName || undefined,
      source: lead.source,
      address: lead.address || undefined,
      locality: lead.locality || undefined,
      province: lead.province || undefined,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    }], { session });

    await ContactModel.create([{
      tenantId: lead.tenantId,
      clientId: newClient._id,
      firstName,
      lastName,
      email: lead.email || undefined,
      phone: lead.phone || undefined,
      isPrimary: true,
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    }], { session });

    return newClient._id;
  }

  private async createClientFromLeadAndMarkWon(
    lead: ILead,
    userId: string,
    tenantId: string,
  ): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const clientId = await this.createClientFromLead(lead, userId, session);

      const updatedLead = await LeadModel.findOneAndUpdate(
        { _id: lead._id, tenantId: lead.tenantId, deletedAt: null },
        {
          $set: {
            status: 'won',
            isClient: true,
            convertedToClient: clientId,
            convertedAt: new Date(),
            qualificationStatus: 'qualified',
            updatedBy: userId,
          },
        },
        { new: true, session },
      ).exec();

      if (!updatedLead) {
        throw new ConflictError('Failed to update lead after conversion');
      }

      await session.commitTransaction();
      session.endSession();

      try {
        await eventBus.publish({
          type: DOMAIN_EVENTS.LEAD_CONVERTED,
          aggregateId: String(lead._id),
          aggregateType: 'Lead',
          tenantId,
          userId,
          timestamp: new Date(),
          payload: {
            leadId: String(lead._id),
            clientId: String(clientId),
          } as LeadConvertedPayload,
        });
      } catch (eventError) {
        console.error('[LeadService] Failed to publish LEAD_CONVERTED:', eventError);
      }
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async listLeads(
    filters: LeadListFilters,
    tenantId: string,
  ): Promise<LeadListResult> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    };

    if (filters.status) {
      filter.status = filters.status;
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

    const total = await LeadModel.countDocuments(filter).exec();

    const page = await cursorPage(LeadModel, filter, {
      limit: filters.limit || 20,
      cursor: filters.cursor,
      sort: { createdAt: -1 },
    } as never);

    return {
      data: page.data as unknown as ILead[],
      cursor: page.cursor ?? undefined,
      total,
    };
  }

  async getLead(
    leadId: string,
    tenantId: string,
  ): Promise<ILead | null> {
    const lead = await LeadModel.findOne({
      _id: new Types.ObjectId(leadId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    })
      .populate('assignedTo', 'name email')
      
      .exec();

    if (!lead) return null;

    // If lead is converted to client, get active Gestion
    if (lead.convertedToClient) {
      try {
        const GestionModel = (await import('@/gestion/models/gestion')).default;
        const activeGestion = await GestionModel.findOne({
          clientId: lead.convertedToClient,
          tenantId: new Types.ObjectId(tenantId),
          status: { $nin: ['won', 'lost'] },
        }).lean();

        if (activeGestion) {
          // Add activeGestion to lead response
          (lead as any).activeGestion = {
            _id: String(activeGestion._id),
            status: activeGestion.status,
            name: activeGestion.name,
            createdAt: activeGestion.createdAt,
          };
        }
      } catch (gestionError) {
        console.error('[LeadService] Error fetching activeGestion:', gestionError);
      }
    }

    return lead as unknown as ILead | null;
  }

  async updateLead(
    leadId: string,
    data: UpdateLeadInput,
    userId: string,
    tenantId: string,
  ): Promise<ILead | null> {
    if ((data as Record<string, unknown>).status) {
      throw new ValidationError('Cannot change status via update. Use changeStatus instead.');
    }

    const { assignedTo, ...updateData } = data;

    if (assignedTo) {
      await assignmentService.assign(leadId, assignedTo, userId, tenantId);
    }

    const updatedLead = await LeadModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(leadId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      },
      { $set: { ...updateData, updatedBy: userId } },
      { new: true },
    )
      
      .exec();

    if (!updatedLead) return null;

    await logActivity({
      tenantId,
      entityType: 'lead',
      entityId: leadId,
      action: 'updated',
      actorId: userId,
      changes: { after: updateData as Record<string, unknown> },
    });

    return updatedLead as unknown as ILead;
  }

  async changeStatus(
    leadId: string,
    newStatus: LeadStatus,
    userId: string,
    tenantId: string,
    options?: { skipClientCheck?: boolean },
  ): Promise<ILead> {
    const lead = await LeadModel.findOne({
      _id: new Types.ObjectId(leadId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    })
      
      .exec();

    if (!lead) {
      throw new Error('Lead not found');
    }

    const currentStatus = lead.status as LeadStatus;

    let hasActivity: boolean | undefined;
    let hasRequiredFields: boolean | undefined;
    let hasClient: boolean | undefined;

    if (currentStatus === 'new' && newStatus === 'contacted') {
      const exists = await ActivityModel.exists({
        entityType: 'lead',
        entityId: new Types.ObjectId(leadId),
        activityType: { $in: ['call', 'email'] },
      });
      hasActivity = !!exists;
    }

    if ((currentStatus === 'contacted' && newStatus === 'quote_sent') || (currentStatus === 'contacted' && newStatus === 'technical_visit')) {
      hasRequiredFields = !!(
        lead.name?.trim() &&
        (lead.email?.trim() || lead.phone?.trim()) &&
        lead.companyName?.trim()
      );
    }

    // Skip client check if explicitly requested (e.g., for document-based direct sales)
    if (options?.skipClientCheck) {
      hasClient = true;
    }

    validateTransition(currentStatus, newStatus, { hasActivity, hasRequiredFields, hasClient });

    const updatedLead = await LeadModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(leadId),
        tenantId: new Types.ObjectId(tenantId),
        status: currentStatus,
        deletedAt: null,
      },
      { $set: { status: newStatus, updatedBy: userId } },
      { new: true },
    )
      
      .exec();

    if (!updatedLead) {
      throw new ConflictError('Cannot change status, concurrent modification');
    }

    // Si el lead pasa a "won", crear Cliente y Gestión automáticamente
    if (newStatus === 'won') {
      try {
        console.log('[LeadService] Lead won - creating Client and Gestion automatically');
        
        // Buscar si ya existe Cliente con ese teléfono
        const existingClient = await (await import('@/crm/models/client')).default.findOne({
          tenantId: new Types.ObjectId(tenantId),
          phone: lead.phone,
          deletedAt: null,
        }).lean();

        let clientId: string;
        
        if (existingClient) {
          clientId = String(existingClient._id);
          console.log('[LeadService] Client already exists:', clientId);
        } else {
          // Crear Cliente desde el Lead
          const newClient = await (await import('@/crm/models/client')).default.create({
            tenantId: new Types.ObjectId(tenantId),
            fullName: lead.name,
            companyName: lead.companyName,
            phone: lead.phone,
            email: lead.email,
            address: lead.address,
            locality: lead.locality,
            province: lead.province,
            source: lead.source,
            status: 'active',
            operationStatus: 'none',
            createdBy: userId,
            updatedBy: userId,
          });
          clientId = String(newClient._id);
          console.log('[LeadService] Created Client:', clientId);
        }

        // Crear Gestión
        const gestionService = new (await import('@/gestion/services/gestion.service')).GestionService();
        const newGestion = await gestionService.createGestion({
          clientId,
          name: 'Gestión inicial',
          source: lead.source || 'whatsapp',
        }, userId, tenantId);
        console.log('[LeadService] Created Gestion:', String(newGestion._id));

      } catch (conversionError) {
        console.error('[LeadService] Error creating Client/Gestion from won lead:', conversionError);
        // No lanzar error - el Lead ya se marcó como won
      }
    }

    try {
      await eventBus.publish({
        type: DOMAIN_EVENTS.LEAD_STATUS_CHANGED,
        aggregateId: leadId,
        aggregateType: 'Lead',
        tenantId,
        userId,
        timestamp: new Date(),
        payload: {
          leadId,
          from: currentStatus,
          to: newStatus,
          leadName: lead.name,
        } as LeadStatusChangedPayload,
      });
    } catch (eventError) {
      console.error('[LeadService] Failed to publish LEAD_STATUS_CHANGED:', eventError);
    }

    return updatedLead as unknown as ILead;
  }

  async convertToClient(
    leadId: string,
    userId: string,
    tenantId: string,
  ): Promise<{ client: Record<string, unknown>; contact: Record<string, unknown>; lead: Record<string, unknown> }> {
    const lead = await LeadModel.findOne({
      _id: new Types.ObjectId(leadId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
      status: { $in: ['contacted', 'technical_visit', 'quote_sent', 'negotiation'] },
      convertedToClient: null,
    }).exec();

    if (!lead) {
      const existing = await LeadModel.findOne({
        _id: new Types.ObjectId(leadId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      }).exec();

      if (!existing) {
        throw new Error('Lead not found');
      }
      if (!['contacted', 'technical_visit', 'quote_sent', 'negotiation'].includes(existing.status)) {
        throw new ValidationError(
          `Lead must be in 'contacted', 'technical_visit', 'quote_sent', or 'negotiation' status to convert. Current status: '${existing.status}'`,
        );
      }
      if (existing.convertedToClient) {
        throw new ValidationError('Lead has already been converted to a client');
      }
      throw new Error('Cannot convert lead');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const nameParts = lead.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || firstName;

      const [client] = await ClientModel.create([{
        tenantId: lead.tenantId,
        customerType: 'residential',
        status: 'active',
        fullName: lead.name,
        companyName: lead.companyName || undefined,
        profileName: (lead as any).profileName || lead.companyName || undefined,
        source: lead.source,
        address: lead.address || undefined,
        locality: lead.locality || undefined,
        province: lead.province || undefined,
        createdBy: userId,
        updatedBy: userId,
      }], { session });

      const [contact] = await ContactModel.create([{
        tenantId: lead.tenantId,
        clientId: client._id,
        firstName,
        lastName,
        email: lead.email || undefined,
        phone: lead.phone || undefined,
        isPrimary: true,
        createdBy: userId,
        updatedBy: userId,
      }], { session });

      const updatedLead = await LeadModel.findOneAndUpdate(
        {
          _id: lead._id,
          status: { $in: ['technical_visit', 'quote_sent', 'negotiation'] },
          convertedToClient: null,
        },
        {
          $set: {
            status: 'won',
            isClient: true,
            convertedToClient: client._id,
            convertedAt: new Date(),
            updatedBy: userId,
          },
        },
        { new: true, session },
      ).exec();

      if (!updatedLead) {
        throw new ConflictError('Lead was already converted by another user');
      }

      // Migrar conversación de lead a cliente
      console.log('[LeadService] Migrando conversación - leadId:', lead._id, 'clientId:', client._id);
      const convResult = await ConversationModel.updateMany(
        {
          leadId: lead._id,
          conversationType: 'lead',
        },
        {
          $set: {
            clientId: client._id,
            conversationType: 'customer',
            lifecycleState: 'ACTIVE_CLIENT',
            'engineData.isCustomer': true,
            'engineData.clientId': String(client._id),
          },
        },
        { session }
      );
      console.log('[LeadService] Conversaciones migradas:', convResult.modifiedCount);

      // También agregar phoneNumber a la conversación (si no existe) para poder buscar por teléfono
      if (lead.phone) {
        const phoneNumberUpdate = await ConversationModel.updateMany(
          {
            leadId: lead._id,
            phoneNumber: { $exists: false },
          },
          {
            $set: {
              phoneNumber: lead.phone,
            },
          },
          { session }
        );
        console.log('[LeadService] phoneNumber agregado a conversaciones:', phoneNumberUpdate.modifiedCount);
      }

      // Migrar mensajes de WhatsApp del lead al cliente (agregar clientId)
      console.log('[LeadService] Migrando mensajes - leadId:', lead._id, 'clientId:', client._id);
      const msgResult = await WhatsAppMessageModel.updateMany(
        {
          leadId: lead._id,
        },
        {
          $set: {
            clientId: client._id,
          },
        },
        { session }
      );
      console.log('[LeadService] Mensajes migrados:', msgResult.modifiedCount);

      await session.commitTransaction();

      try {
        await eventBus.publish({
          type: DOMAIN_EVENTS.LEAD_CONVERTED,
          aggregateId: leadId,
          aggregateType: 'Lead',
          tenantId,
          userId,
          timestamp: new Date(),
          payload: {
            leadId,
            clientId: String(client._id),
          } as LeadConvertedPayload,
        });
      } catch (eventError) {
        console.error('[LeadService] Failed to publish LEAD_CONVERTED:', eventError);
      }

      return {
        client: client.toObject() as unknown as Record<string, unknown>,
        contact: contact.toObject() as unknown as Record<string, unknown>,
        lead: updatedLead.toObject() as unknown as Record<string, unknown>,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getLeadsGroupedByStage(
    pipelineId: string,
    tenantId: string,
    userId: string,
    role: string,
    filters: GroupedFilters,
  ): Promise<GroupedResult> {
    const pipeline = await PipelineModel.findOne({
      _id: new Types.ObjectId(pipelineId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    }).lean().exec() as unknown as IPipeline | null;

    if (!pipeline) {
      throw new ValidationError('Pipeline not found');
    }

    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    };

    if (filters.assignedTo) {
      filter.assignedTo = new Types.ObjectId(filters.assignedTo);
    }

    if (filters.search) {
      const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { companyName: { $regex: escaped, $options: 'i' } },
      ];
    }

    if (filters.createdAtGte || filters.createdAtLte) {
      const dateFilter: Record<string, unknown> = {};
      if (filters.createdAtGte) dateFilter.$gte = new Date(filters.createdAtGte);
      if (filters.createdAtLte) dateFilter.$lte = new Date(filters.createdAtLte);
      filter.createdAt = dateFilter;
    }

    // Pipeline is a team view — no role-based scope filter.
    // All non-terminal leads are visible regardless of assignment.

    const leads = await LeadModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .populate('assignedTo', 'name email')
      .lean()
      .exec() as unknown as ILead[];

    // Ordenar leads: prioridad > temperatura > score > fecha
    const sortLeads = (a: ILead, b: ILead): number => {
      const getPriorityScore = (p?: string) => {
        if (p === 'high') return 300;
        if (p === 'medium') return 200;
        if (p === 'low') return 100;
        return 0;
      };
      
      const getTempScore = (t?: string) => {
        if (t === 'hot') return 30;
        if (t === 'warm') return 20;
        if (t === 'cold') return 10;
        return 0;
      };
      
      const aScore = a.score || 0;
      const bScore = b.score || 0;
      
      // Score compuesto: priority(300/200/100) + temp(30/20/10) + score + recencia
      const aTotal = getPriorityScore(a.priority) + getTempScore(a.temperature) + aScore + (a.createdAt ? (10000000000 - new Date(a.createdAt).getTime() / 1000000) : 0);
      const bTotal = getPriorityScore(b.priority) + getTempScore(b.temperature) + bScore + (b.createdAt ? (10000000000 - new Date(b.createdAt).getTime() / 1000000) : 0);
      
      return bTotal - aTotal; // Mayor score primero
    };

    leads.sort(sortLeads);

    const activeStages = pipeline.stages.filter(s => s.isActive);
    const statusToStages = new Map<string, IPipelineStage[]>();
    for (const stage of activeStages) {
      if (stage.mapsToStatus) {
        const list = statusToStages.get(stage.mapsToStatus) || [];
        list.push(stage);
        statusToStages.set(stage.mapsToStatus, list);
      }
    }

    const groups: Record<string, { stage: IPipelineStage; leads: ILead[] }> = {};
    const unmatched: ILead[] = [];
    const truncated: Record<string, boolean> = {};

    for (const stage of activeStages) {
      groups[stage.name] = { stage, leads: [] };
    }

    for (const lead of leads) {
      const matchedStages = statusToStages.get(lead.status);
      if (matchedStages && matchedStages.length > 0) {
        for (const matchedStage of matchedStages) {
          if (groups[matchedStage.name] && groups[matchedStage.name].leads.length < 500) {
            groups[matchedStage.name].leads.push(lead);
          } else if (groups[matchedStage.name]) {
            truncated[matchedStage.name] = true;
          }
        }
      } else {
        unmatched.push(lead);
      }
    }

    return { pipeline, groups, unmatched, truncated };
  }

  async softDelete(
    leadId: string,
    userId: string,
    tenantId: string,
  ): Promise<ILead | null> {
    const lead = await LeadModel.findOne({
      _id: new Types.ObjectId(leadId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    })
      
      .exec();

    if (!lead) return null;

    if (lead.status === 'won') {
      throw new ValidationError('Cannot delete a lead that has been converted to a client');
    }

    const updatedLead = await LeadModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(leadId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      },
      { $set: { deletedAt: new Date(), deletedBy: userId } },
      { new: true },
    )
      
      .exec();

    if (!updatedLead) return null;

    await logActivity({
      tenantId,
      entityType: 'lead',
      entityId: leadId,
      action: 'deleted',
      actorId: userId,
    });

    return updatedLead as unknown as ILead;
  }
}

async function applyRoleScope(
  filter: Record<string, unknown>,
  role: string,
  userId: string,
  tenantId: string,
): Promise<void> {
  switch (role) {
    case 'admin':
    case 'Owner':
    case 'Administrator':
      break;
    case 'Supervisor': {
      // TODO: supervisorId does not exist on UserModel yet.
      // When added, query: UserModel.find({ tenantId, supervisorId: userId }).select('_id').lean()
      // and build $in array with userId + supervisee IDs.
      // For now, supervisor sees own leads only.
      filter.assignedTo = new Types.ObjectId(userId);
      break;
    }
    default:
      filter.assignedTo = new Types.ObjectId(userId);
      break;
  }
}
