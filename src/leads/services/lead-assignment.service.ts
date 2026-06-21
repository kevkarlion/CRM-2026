import { Types } from 'mongoose';
import LeadAssignmentModel from '../models/lead-assignment';
import LeadModel from '../models/lead';
import { ILeadAssignment } from '../types/lead-assignment';
import { ILead } from '../types/lead';
import { logActivity } from '../../audit/activity-logger';

export class LeadAssignmentService {
  async assign(
    leadId: string,
    userId: string,
    assignedBy: string,
    tenantId: string,
    reason?: string,
  ): Promise<{ lead: ILead; assignment: ILeadAssignment }> {
    const lead = await LeadModel.findOne({
      _id: new Types.ObjectId(leadId),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    }).lean().exec();

    if (!lead) {
      throw new Error(`Lead ${leadId} not found in tenant ${tenantId}.`);
    }

    await LeadAssignmentModel.findOneAndUpdate(
      {
        leadId: new Types.ObjectId(leadId),
        tenantId: new Types.ObjectId(tenantId),
        unassignedAt: null,
      },
      { $set: { unassignedAt: new Date() } },
    ).lean().exec();

    const assignment = await LeadAssignmentModel.create({
      tenantId: new Types.ObjectId(tenantId),
      leadId: new Types.ObjectId(leadId),
      userId: new Types.ObjectId(userId),
      assignedBy: new Types.ObjectId(assignedBy),
      assignedAt: new Date(),
      reason,
    });

    const updatedLead = await LeadModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(leadId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      },
      { $set: { assignedTo: new Types.ObjectId(userId) } },
      { new: true },
    ).lean().exec();

    if (!updatedLead) {
      throw new Error(`Lead ${leadId} not found after assignment.`);
    }

    await logActivity({
      tenantId,
      entityType: 'lead',
      entityId: leadId,
      action: 'assigned',
      actorId: assignedBy,
      metadata: {
        userId,
        assignmentId: String(assignment._id),
        reason,
      },
    });

    return {
      assignment: assignment.toObject() as unknown as ILeadAssignment,
      lead: updatedLead as unknown as ILead,
    };
  }

  async unassign(
    leadId: string,
    tenantId: string,
    userId: string,
  ): Promise<{ lead: ILead; assignment: ILeadAssignment }> {
    const assignment = await LeadAssignmentModel.findOneAndUpdate(
      {
        leadId: new Types.ObjectId(leadId),
        tenantId: new Types.ObjectId(tenantId),
        unassignedAt: null,
      },
      { $set: { unassignedAt: new Date() } },
      { new: true },
    ).lean().exec();

    if (!assignment) {
      throw new Error(`No active assignment found for Lead ${leadId}.`);
    }

    const updatedLead = await LeadModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(leadId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      },
      { $set: { assignedTo: null } },
      { new: true },
    ).lean().exec();

    if (!updatedLead) {
      throw new Error(`Lead ${leadId} not found.`);
    }

    await logActivity({
      tenantId,
      entityType: 'lead',
      entityId: leadId,
      action: 'unassigned',
      actorId: userId,
      metadata: {
        previousUserId: String(assignment.userId),
      },
    });

    return {
      assignment: assignment as unknown as ILeadAssignment,
      lead: updatedLead as unknown as ILead,
    };
  }

  async reassign(
    leadId: string,
    newUserId: string,
    assignedBy: string,
    tenantId: string,
    reason?: string,
  ): Promise<{ lead: ILead; assignment: ILeadAssignment }> {
    return this.assign(leadId, newUserId, assignedBy, tenantId, reason);
  }

  async getAssignmentHistory(
    leadId: string,
    tenantId: string,
  ): Promise<ILeadAssignment[]> {
    return LeadAssignmentModel.find({
      tenantId: new Types.ObjectId(tenantId),
      leadId: new Types.ObjectId(leadId),
    })
      .sort({ assignedAt: -1 })
      .lean()
      .exec() as unknown as ILeadAssignment[];
  }

  async getActiveAssignments(
    userId: string,
    tenantId: string,
  ): Promise<ILeadAssignment[]> {
    return LeadAssignmentModel.find({
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(userId),
      unassignedAt: null,
    })
      .lean()
      .exec() as unknown as ILeadAssignment[];
  }
}
