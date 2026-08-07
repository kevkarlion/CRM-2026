import { Types } from 'mongoose';
import TimelineEventModel from '../models/timeline-event';
import { CreateTimelineEventInput, ITimelineEvent } from '../types/timeline-event';

export class TimelineService {
  async create(data: CreateTimelineEventInput): Promise<ITimelineEvent> {
    const doc: Record<string, unknown> = {
      tenantId: new Types.ObjectId(data.tenantId),
      entityType: data.entityType,
      entityId: new Types.ObjectId(data.entityId),
      eventType: data.eventType,
      title: data.title,
      description: data.description,
      summary: data.summary,
      icon: data.icon,
      color: data.color,
      performedBy: new Types.ObjectId(data.performedBy),
      metadata: data.metadata,
    };
    if (data.leadId) doc.leadId = new Types.ObjectId(data.leadId);
    if (data.clientId) doc.clientId = new Types.ObjectId(data.clientId);

    const event = await TimelineEventModel.create(doc);

    return event.toObject();
  }

  async findByLead(leadId: string, tenantId: string): Promise<ITimelineEvent[]> {
    const results = await TimelineEventModel.find({
      leadId: new Types.ObjectId(leadId),
      tenantId: new Types.ObjectId(tenantId),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('performedBy', 'firstName lastName email')
      .lean<ITimelineEvent[]>();

    return results;
  }

  async findByClient(clientId: string, tenantId: string): Promise<ITimelineEvent[]> {
    const results = await TimelineEventModel.find({
      clientId: new Types.ObjectId(clientId),
      tenantId: new Types.ObjectId(tenantId),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('performedBy', 'firstName lastName email')
      .lean<ITimelineEvent[]>();

    return results;
  }
}

export const timelineService = new TimelineService();
