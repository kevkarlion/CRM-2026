import mongoose, { Types } from 'mongoose';
import LeadModel from '../models/lead';
import { LeadAssignmentService } from './lead-assignment.service';
import { validateTransition, TransitionError } from '../helpers/lead-state-machine';
import { findDuplicates } from '../helpers/duplicate-detection';
import { logActivity } from '../../audit/activity-logger';
import ActivityModel from '../../crm/models/activity';
import ClientModel from '../../crm/models/client';
import ContactModel from '../../crm/models/contact';
import { cursorPage } from '../../crm/helpers/cursor-pagination';
import type { ILead, LeadStatus, CreateLeadInput, UpdateLeadInput } from '../types/lead';

const assignmentService = new LeadAssignmentService();

export interface DuplicateWarning {
  leadId: string;
  matchedField: string;
  matchedValue: string;
}

export interface CreateLeadResult {
  lead: ILead;
  warnings?: DuplicateWarning[];
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
      const duplicates = await findDuplicates(tenantId, data.email, data.phone, data.companyName);
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

    const { assignedTo, ...leadData } = data;

    const lead = await LeadModel.create({
      ...leadData,
      status: 'new',
      createdBy: userId,
      updatedBy: userId,
      tenantId: new Types.ObjectId(tenantId),
    });

    if (assignedTo) {
      await assignmentService.assign(String(lead._id), assignedTo, userId, tenantId);
    }

    await logActivity({
      tenantId,
      entityType: 'lead',
      entityId: String(lead._id),
      action: 'created',
      actorId: userId,
    });

    const result: CreateLeadResult = { lead: lead.toObject() as unknown as ILead };
    if (warnings.length > 0) {
      result.warnings = warnings;
    }
    return result;
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
      .lean()
      .exec();

    return lead as unknown as ILead | null;
  }

  async updateLead(
    leadId: string,
    data: UpdateLeadInput,
    userId: string,
    tenantId: string,
  ): Promise<ILead | null> {
    if (data.status) {
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
      .lean()
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
  ): Promise<ILead> {
    const lead = await LeadModel.findOne({
      _id: new Types.ObjectId(leadId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    })
      .lean()
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

    if (currentStatus === 'contacted' && newStatus === 'qualified') {
      hasRequiredFields = !!(
        lead.name?.trim() &&
        (lead.email?.trim() || lead.phone?.trim()) &&
        lead.companyName?.trim()
      );
    }

    if (currentStatus === 'qualified' && newStatus === 'won') {
      hasClient = !!lead.convertedToClient;
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
      .lean()
      .exec();

    if (!updatedLead) {
      throw new ConflictError('Cannot change status, concurrent modification');
    }

    await logActivity({
      tenantId,
      entityType: 'lead',
      entityId: leadId,
      action: 'statusChanged',
      actorId: userId,
      changes: {
        before: { status: currentStatus },
        after: { status: newStatus },
      },
    });

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
      status: 'qualified',
      convertedToClient: null,
    }).exec();

    if (!lead) {
      const existing = await LeadModel.findOne({
        _id: new Types.ObjectId(leadId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      }).lean().exec();

      if (!existing) {
        throw new Error('Lead not found');
      }
      if (existing.status !== 'qualified') {
        throw new ValidationError(
          `Lead must be in 'qualified' status to convert. Current status: '${existing.status}'`,
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

      if (lead.notes) {
        await ActivityModel.create([{
          tenantId: lead.tenantId,
          entityType: 'client',
          entityId: client._id,
          activityType: 'note',
          title: 'Notas del Lead original',
          description: lead.notes,
          performedBy: userId,
          metadata: { sourceLeadId: lead._id },
        }], { session });
      }

      await ActivityModel.create([{
        tenantId: lead.tenantId,
        entityType: 'lead',
        entityId: lead._id,
        activityType: 'note',
        title: 'Convertido a Cliente',
        description: `Cliente creado: ${client.fullName || client.companyName}`,
        performedBy: userId,
        metadata: { clientId: client._id },
      }], { session });

      const updatedLead = await LeadModel.findOneAndUpdate(
        {
          _id: lead._id,
          status: 'qualified',
          convertedToClient: null,
        },
        {
          $set: {
            status: 'won',
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

      await session.commitTransaction();

      await logActivity({
        tenantId,
        entityType: 'lead',
        entityId: leadId,
        action: 'converted',
        actorId: userId,
        metadata: { clientId: String(client._id) },
      });

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
      .lean()
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
      .lean()
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
