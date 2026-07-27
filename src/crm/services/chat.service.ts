import { Types } from 'mongoose';
import WhatsAppMessageModel from '../models/whatsapp-message';
import LeadModel from '../../leads/models/lead';
import type {
  IWhatsAppMessage,
  CreateWhatsAppMessageInput,
  WhatsAppConversation,
  WhatsAppMessageStatus,
} from '../types/whatsapp-message';

export class ChatService {
  /**
   * Lists conversations for a tenant, grouped by phone number.
   * Each conversation shows the last message, unread count, and lead info.
   */
  async listConversations(
    tenantId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<WhatsAppConversation[]> {
    const { limit = 50, offset = 0 } = options;
    const tid = new Types.ObjectId(tenantId);

    // Aggregate last message per phone
    const lastMessages = await WhatsAppMessageModel.aggregate([
      { $match: { tenantId: tid } },
      { $sort: { createdAt: -1 as const } },
      {
        $group: {
          _id: '$phone',
          leadId: { $first: '$leadId' },
          lastMessage: {
            $first: {
              content: '$content',
              direction: '$direction',
              type: '$type',
              createdAt: '$createdAt',
            },
          },
          totalMessages: { $sum: 1 },
          lastActivity: { $first: '$createdAt' },
        },
      },
      { $sort: { lastActivity: -1 as const } },
      { $skip: offset },
      { $limit: limit },
    ]);

    if (lastMessages.length === 0) return [];

    // Batch fetch unread counts
    const phones = lastMessages.map((m) => m._id);
    const unreadCounts = await WhatsAppMessageModel.aggregate([
      {
        $match: {
          tenantId: tid,
          phone: { $in: phones },
          direction: 'inbound',
          status: { $in: ['pending', 'sent', 'delivered'] },
        },
      },
      {
        $group: {
          _id: '$phone',
          count: { $sum: 1 },
        },
      },
    ]);

    const unreadMap = new Map<string, number>(
      unreadCounts.map((u) => [u._id, u.count])
    );

    // Batch fetch lead names
    const leadIds = lastMessages
      .map((m) => m.leadId)
      .filter(Boolean)
      .map((id) => new Types.ObjectId(id));

    const leads = leadIds.length > 0
      ? await LeadModel.find({ _id: { $in: leadIds } })
          .select('_id name')
          .lean()
      : [];

    const leadMap = new Map<string, string>(
      leads.map((l) => [String(l._id), l.name])
    );

    return lastMessages.map((m) => ({
      phone: m._id,
      leadId: m.leadId ? new Types.ObjectId(m.leadId) : undefined,
      leadName: m.leadId ? leadMap.get(String(m.leadId)) : undefined,
      lastMessage: m.lastMessage,
      unreadCount: unreadMap.get(m._id) || 0,
      totalMessages: m.totalMessages,
      lastActivity: m.lastActivity,
    }));
  }

  /**
   * Gets messages for a specific phone conversation, ordered chronologically.
   */
  async getConversationMessages(
    tenantId: string,
    phone: string,
    options: { limit?: number; before?: Date } = {}
  ): Promise<IWhatsAppMessage[]> {
    const { limit = 50, before } = options;
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      phone,
    };

    if (before) {
      query.createdAt = { $lt: before };
    }

    // Sort ascending (oldest first) for chat view
    return WhatsAppMessageModel.find(query)
      .sort({ createdAt: 1 })
      .limit(limit)
      .exec();
  }

  /**
   * Marks inbound messages as read for a conversation.
   */
  async markAsRead(
    tenantId: string,
    phone: string
  ): Promise<{ modifiedCount: number }> {
    const result = await WhatsAppMessageModel.updateMany(
      {
        tenantId: new Types.ObjectId(tenantId),
        phone,
        direction: 'inbound',
        status: { $ne: 'read' },
      },
      {
        $set: {
          status: 'read' as WhatsAppMessageStatus,
          readAt: new Date(),
        },
      }
    );

    return { modifiedCount: result.modifiedCount };
  }

  /**
   * Updates the status of an outbound message by its Meta message ID.
   */
  async updateMessageStatus(
    tenantId: string,
    messageId: string,
    status: WhatsAppMessageStatus,
    errorMessage?: string
  ): Promise<IWhatsAppMessage | null> {
    const update: Record<string, unknown> = { status };
    if (status === 'delivered') update.deliveredAt = new Date();
    if (status === 'read') update.readAt = new Date();
    if (errorMessage) update.errorMessage = errorMessage;

    return WhatsAppMessageModel.findOneAndUpdate(
      {
        tenantId: new Types.ObjectId(tenantId),
        messageId,
      },
      { $set: update },
      { new: true }
    );
  }

  /**
   * Sends a message and persists it with status 'pending'.
   */
  async sendMessage(
    tenantId: string,
    input: CreateWhatsAppMessageInput
  ): Promise<IWhatsAppMessage> {
    const message = new WhatsAppMessageModel({
      ...input,
      status: 'pending',
    });
    await message.save();
    return message;
  }
}

export default new ChatService();
