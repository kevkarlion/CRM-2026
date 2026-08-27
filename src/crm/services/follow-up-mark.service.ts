import { Types } from 'mongoose';
import { FollowUpMarkModel } from '../models';
import { CreateFollowUpMarkInput, IFollowUpMark } from '../types/follow-up-mark';
import LeadModel from '@/leads/models/lead';
import ClientModel from '@/crm/models/client';

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class FollowUpMarkService {
  /**
   * Create a new follow-up mark with duplicate detection.
   * Prevents creating duplicate marks for the same lead/client + assignedTo combination.
   */
  async createMark(
    tenantId: string,
    data: CreateFollowUpMarkInput & { markedBy: string },
    userId: string
  ): Promise<IFollowUpMark> {
    const tenantObjectId = new Types.ObjectId(tenantId);

    // Build filter for duplicate check
    const duplicateFilter: Record<string, unknown> = {
      tenantId: tenantObjectId,
      assignedTo: data.assignedTo,
    };

    // Check for lead or client duplicate
    if (data.leadId) {
      duplicateFilter.leadId = new Types.ObjectId(data.leadId);
    }
    if (data.clientId) {
      duplicateFilter.clientId = new Types.ObjectId(data.clientId);
    }

    // Prevent duplicate: same entity + same assignee
    const existing = await FollowUpMarkModel.findOne(duplicateFilter).exec();
    if (existing) {
      throw new ConflictError(
        `Ya existe una marca de seguimiento para este ${data.leadId ? 'lead' : 'cliente'} con este usuario`
      );
    }

    const createData: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      assignedTo: data.assignedTo,
      markedBy: new Types.ObjectId(userId),
      markedAt: new Date(),
    };

    if (data.leadId) {
      createData.leadId = new Types.ObjectId(data.leadId);
    }
    if (data.clientId) {
      createData.clientId = new Types.ObjectId(data.clientId);
    }
    if (data.note) {
      createData.note = data.note;
    }

    const mark = await FollowUpMarkModel.create(createData);

    return mark.toObject() as unknown as IFollowUpMark;
  }

  /**
   * Get all follow-up marks assigned to a specific user.
   * Returns marks with populated target data (lead/client info).
   * @param since - optional Date to filter marks created after this time
   */
  async getMarksForUser(tenantId: string, userEmail: string, since?: Date): Promise<IFollowUpMark[]> {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      assignedTo: userEmail,
    };
    
    // Filter by creation date if 'since' is provided
    if (since) {
      query.createdAt = { $gt: since };
    }

    const marks = await FollowUpMarkModel.find(query)
      .sort({ markedAt: -1 })
      .lean();

    // Transform marks to include targetType and target populated data
    const transformedMarks = await Promise.all(
      marks.map(async (mark) => {
        const result: Record<string, unknown> = { ...mark };

        // Determine targetType and populate target info
        if (mark.leadId) {
          result.targetType = 'lead';
          result.targetId = String(mark.leadId);
          const lead = await LeadModel.findOne({ _id: mark.leadId }).select('name profileName phone status').lean();
          if (lead) {
            result.target = {
              _id: String(lead._id),
              name: (lead as { profileName?: string; name?: string }).profileName || (lead as { name: string }).name,
              status: (lead as { status?: string }).status,
            };
          }
        } else if (mark.clientId) {
          result.targetType = 'client';
          result.targetId = String(mark.clientId);
          const client = await ClientModel.findOne({ _id: mark.clientId }).select('fullName profileName companyName status').lean();
          if (client) {
            result.target = {
              _id: String(client._id),
              name: (client as { profileName?: string; fullName?: string; companyName?: string }).profileName ||
                    (client as { fullName?: string }).fullName ||
                    (client as { companyName?: string }).companyName ||
                    'Sin nombre',
              status: (client as { status?: string }).status,
            };
          }
        }

        return result as unknown as IFollowUpMark;
      })
    );

    return transformedMarks as unknown as IFollowUpMark[];
  }

  /**
   * Get ALL follow-up marks for a tenant (for pipeline badges).
   * Returns marks with populated target data.
   * @param since - optional Date to filter marks created after this time
   */
  async getAllMarksForTenant(tenantId: string, since?: Date): Promise<IFollowUpMark[]> {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
    };
    
    // Filter by creation date if 'since' is provided
    if (since) {
      query.createdAt = { $gt: since };
    }

    const marks = await FollowUpMarkModel.find(query)
      .sort({ markedAt: -1 })
      .lean();

    // Transform marks to include targetType and target populated data
    const transformedMarks = await Promise.all(
      marks.map(async (mark) => {
        const result: Record<string, unknown> = { ...mark };

        if (mark.leadId) {
          result.targetType = 'lead';
          result.targetId = String(mark.leadId);
          const lead = await LeadModel.findOne({ _id: mark.leadId }).select('name profileName phone status').lean();
          if (lead) {
            result.target = {
              _id: String(lead._id),
              name: (lead as { profileName?: string; name?: string }).profileName || (lead as { name: string }).name,
              status: (lead as { status?: string }).status,
            };
          }
        } else if (mark.clientId) {
          result.targetType = 'client';
          result.targetId = String(mark.clientId);
          const client = await ClientModel.findOne({ _id: mark.clientId }).select('fullName profileName companyName status').lean();
          if (client) {
            result.target = {
              _id: String(client._id),
              name: (client as { profileName?: string; fullName?: string; companyName?: string }).profileName ||
                    (client as { fullName?: string }).fullName ||
                    (client as { companyName?: string }).companyName ||
                    'Sin nombre',
              status: (client as { status?: string }).status,
            };
          }
        }

        return result as unknown as IFollowUpMark;
      })
    );

    return transformedMarks as unknown as IFollowUpMark[];
  }

  /**
   * Get all follow-up marks for a specific lead.
   */
  async getMarksForLead(tenantId: string, leadId: string): Promise<IFollowUpMark[]> {
    const marks = await FollowUpMarkModel.find({
      tenantId: new Types.ObjectId(tenantId),
      leadId: new Types.ObjectId(leadId),
    })
      .sort({ markedAt: -1 })
      .lean();

    return marks as unknown as IFollowUpMark[];
  }

  /**
   * Get all follow-up marks for a specific client.
   */
  async getMarksForClient(tenantId: string, clientId: string): Promise<IFollowUpMark[]> {
    const marks = await FollowUpMarkModel.find({
      tenantId: new Types.ObjectId(tenantId),
      clientId: new Types.ObjectId(clientId),
    })
      .sort({ markedAt: -1 })
      .lean();

    return marks as unknown as IFollowUpMark[];
  }

  /**
   * Delete a follow-up mark by ID.
   * Returns the deleted document or throws NotFoundError.
   */
  async deleteMark(tenantId: string, markId: string): Promise<IFollowUpMark> {
    const result = await FollowUpMarkModel.findOneAndDelete({
      _id: new Types.ObjectId(markId),
      tenantId: new Types.ObjectId(tenantId),
    })
      .lean()
      .exec();

    if (!result) {
      throw new NotFoundError('Follow-up mark not found');
    }

    return result as unknown as IFollowUpMark;
  }

  /**
   * Find a single mark by ID (for validation or display).
   */
  async findById(tenantId: string, markId: string): Promise<IFollowUpMark | null> {
    const mark = await FollowUpMarkModel.findOne({
      _id: new Types.ObjectId(markId),
      tenantId: new Types.ObjectId(tenantId),
    })
      .lean()
      .exec();

    return mark as unknown as IFollowUpMark | null;
  }
}

export const followUpMarkService = new FollowUpMarkService();
