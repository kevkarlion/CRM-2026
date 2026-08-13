import { Types } from 'mongoose';
import ConversationModel from '../models/conversation';
import LeadModel from '@/leads/models/lead';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import type { IConversation } from '../domain/conversation';

export interface ConversationWithLead {
  _id: string;
  tenantId: string;
  leadId: string;
  state: string;
  previousState?: string;
  handoffStatus?: string;
  handoffReason?: string;
  assignedToUserId?: string;
  lastMessageAt: Date;
  lastReadAt?: Date;
  startedAt: Date;
  closedAt?: Date;
  createdAt: Date;
  lead: {
    _id: string;
    name: string;
    phone?: string;
    status: string;
    temperature?: string;
    score?: number;
    inquiryReason?: string;
    customerType?: string;
  } | null;
  lastMessage?: {
    content: string;
    direction: string;
    createdAt: Date;
  };
}

export interface ConversationDetail extends ConversationWithLead {
  context: IConversation['context'];
  step: number;
  fallbackCount: number;
  timeoutCount: number;
  exchangesInSameState: number;
  messages: Array<{
    _id: string;
    content: string;
    direction: string;
    type: string;
    status: string;
    createdAt: Date;
  }>;
  stateHistory: Array<{
    state: string;
    timestamp: Date;
  }>;
}

export class ConversationQueryService {
  /**
   * Lists active conversations for a tenant with lead data and last message preview.
   */
  async getActiveConversations(
    tenantId: string,
    options: { status?: string; handoffStatus?: string; limit?: number; offset?: number } = {}
  ): Promise<ConversationWithLead[]> {
    const { status, handoffStatus, limit = 50, offset = 0 } = options;
    const tid = new Types.ObjectId(tenantId);

    const matchFilter: Record<string, unknown> = {
      tenantId: tid,
      state: { $nin: ['closed'] },
    };

    if (status) {
      matchFilter.state = status;
    }

    if (handoffStatus) {
      matchFilter.handoffStatus = handoffStatus;
    }

    const conversations = await ConversationModel.find(matchFilter)
      .sort({ lastMessageAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    if (conversations.length === 0) return [];

    // Batch fetch leads
    const leadIds = [...new Set(conversations.map(c => String(c.leadId)))];
    const leads = await LeadModel.find({ _id: { $in: leadIds.map(id => new Types.ObjectId(id)) } })
      .select('_id name phone status temperature score inquiryReason customerType')
      .lean();

    const leadMap = new Map(leads.map(l => [String(l._id), l]));

    // Batch fetch last messages per conversation
    const conversationIds = conversations.map(c => c._id);
    const lastMessages = await WhatsAppMessageModel.aggregate([
      { $match: { tenantId: tid, leadId: { $in: leadIds.map(id => new Types.ObjectId(id)) } } },
      { $sort: { createdAt: -1 as const } },
      {
        $group: {
          _id: '$leadId',
          content: { $first: '$content' },
          direction: { $first: '$direction' },
          createdAt: { $first: '$createdAt' },
        },
      },
    ]);

    const lastMessageMap = new Map(
      lastMessages.map(m => [String(m._id), { content: m.content, direction: m.direction, createdAt: m.createdAt }])
    );

    return conversations.map(c => {
      const lead = leadMap.get(String(c.leadId));
      const lastMsg = lastMessageMap.get(String(c.leadId));

      return {
        _id: String(c._id),
        tenantId: String(c.tenantId),
        leadId: String(c.leadId),
        state: c.state,
        previousState: c.previousState,
        handoffStatus: c.handoffStatus,
        handoffReason: c.handoffReason,
        assignedToUserId: c.assignedToUserId ? String(c.assignedToUserId) : undefined,
        lastMessageAt: c.lastMessageAt,
        lastReadAt: c.lastReadAt ? new Date(c.lastReadAt) : undefined,
        startedAt: c.startedAt,
        closedAt: c.closedAt,
        createdAt: c.createdAt,
        lead: lead
          ? {
              _id: String(lead._id),
              name: lead.name,
              phone: lead.phone,
              status: lead.status,
              temperature: lead.temperature,
              score: lead.score,
              inquiryReason: lead.inquiryReason,
              customerType: lead.customerType,
            }
          : null,
        lastMessage: lastMsg ?? undefined,
      };
    });
  }

  /**
   * Lists conversations pending handoff for a tenant.
   */
  async getPendingHandoffs(tenantId: string): Promise<ConversationWithLead[]> {
    return this.getActiveConversations(tenantId, { handoffStatus: 'pending' });
  }

  /**
   * Gets full conversation detail with all messages and state history.
   */
  async getConversationDetail(conversationId: string): Promise<ConversationDetail | null> {
    const conversation = await ConversationModel.findById(
      new Types.ObjectId(conversationId)
    ).lean();

    if (!conversation) return null;

    const lead = await LeadModel.findById(conversation.leadId)
      .select('_id name phone status temperature score inquiryReason customerType email companyName')
      .lean();

    // Get messages for this conversation's lead
    const messages = await WhatsAppMessageModel.find({
      leadId: conversation.leadId,
      tenantId: conversation.tenantId,
    })
      .select('_id content direction type status createdAt')
      .sort({ createdAt: 1 })
      .lean();

    // Build state history from timestamps
    const stateHistory = [
      { state: conversation.state, timestamp: conversation.updatedAt },
    ];

    return {
      _id: String(conversation._id),
      tenantId: String(conversation.tenantId),
      leadId: String(conversation.leadId),
      state: conversation.state,
      previousState: conversation.previousState,
      handoffStatus: conversation.handoffStatus,
      handoffReason: conversation.handoffReason,
      assignedToUserId: conversation.assignedToUserId
        ? String(conversation.assignedToUserId)
        : undefined,
      lastMessageAt: conversation.lastMessageAt,
      startedAt: conversation.startedAt,
      closedAt: conversation.closedAt,
      createdAt: conversation.createdAt,
      context: conversation.context,
      step: conversation.step,
      fallbackCount: conversation.fallbackCount,
      timeoutCount: conversation.timeoutCount,
      exchangesInSameState:
        (conversation as unknown as { exchangesInSameState?: number }).exchangesInSameState ?? 0,
      lead: lead
        ? {
            _id: String(lead._id),
            name: lead.name,
            phone: lead.phone,
            status: lead.status,
            temperature: lead.temperature,
            score: lead.score,
            inquiryReason: lead.inquiryReason,
            customerType: lead.customerType,
          }
        : null,
      messages: messages.map(m => ({
        _id: String(m._id),
        content: m.content,
        direction: m.direction,
        type: m.type,
        status: m.status,
        createdAt: m.createdAt,
      })),
      stateHistory,
    };
  }

  /**
   * Gets messages for a specific conversation.
   */
  async getConversationMessages(
    conversationId: string
  ): Promise<Array<{
    _id: string;
    content: string;
    direction: string;
    type: string;
    status: string;
    createdAt: Date;
  }>> {
    const conversation = await ConversationModel.findById(
      new Types.ObjectId(conversationId)
    ).lean();

    if (!conversation) return [];

    const messages = await WhatsAppMessageModel.find({
      leadId: conversation.leadId,
      tenantId: conversation.tenantId,
    })
      .select('_id content direction type status createdAt')
      .sort({ createdAt: 1 })
      .lean();

    return messages.map(m => ({
      _id: String(m._id),
      content: m.content,
      direction: m.direction,
      type: m.type,
      status: m.status,
      createdAt: m.createdAt,
    }));
  }
}
