import { Types } from 'mongoose';
import whatsappService from '@/crm/services/whatsapp.service';
import LeadModel from '@/leads/models/lead';
import ConversationModel from '../models/conversation';
import TimelineEventModel from '@/timeline/models/timeline-event';
import type { BotAction, LeadUpdate } from '../application/types';
import type { ConversationState, LeadContactEstablished } from '../domain/conversation';

export interface WhatsAppBotAdapterDeps {
  whatsappService?: typeof whatsappService;
}

export class WhatsAppBotAdapter {
  private readonly wa: typeof whatsappService;

  constructor(deps?: WhatsAppBotAdapterDeps) {
    this.wa = deps?.whatsappService ?? whatsappService;
  }

  /**
   * Executes a list of BotActions sequentially.
   * Actions are ordered by the use case — send_message first, then side effects.
   */
  async executeActions(
    actions: BotAction[],
    tenantId: string,
    phone: string,
    leadId?: string
  ): Promise<void> {
    for (const action of actions) {
      switch (action.type) {
        case 'send_message':
          await this.sendMessage(action.content, phone, tenantId, leadId);
          break;
        case 'update_lead':
          await this.updateLead(action.leadId, action.updates);
          break;
        case 'trigger_handoff':
          await this.triggerHandoff(
            action.conversationId,
            action.reason,
            action.priority,
            tenantId
          );
          break;
        case 'close_conversation':
          await this.closeConversation(action.conversationId);
          break;
        case 'emit_domain_event':
          await this.handleDomainEvent(action.event, tenantId);
          break;
      }
    }
  }

  /**
   * Sends a WhatsApp text message and persists it.
   * Never throws — if WhatsApp API fails, message is still saved to DB.
   */
  async sendMessage(
    content: string,
    phone: string,
    tenantId: string,
    leadId?: string
  ): Promise<void> {
    // Always persist the outbound message to DB
    try {
      const WhatsAppMessageModel = (await import('@/crm/models/whatsapp-message')).default;
      await WhatsAppMessageModel.create({
        tenantId: new Types.ObjectId(tenantId),
        phone,
        messageId: `wamid.bot.${Date.now()}`,
        direction: 'outbound',
        type: 'text',
        content,
        status: 'sent',
        leadId: leadId ? new Types.ObjectId(leadId) : undefined,
      });
    } catch (dbError) {
      console.error('[WhatsAppBotAdapter] Error saving outbound message to DB:', dbError);
    }

    // Try to send via WhatsApp API (non-blocking)
    try {
      await this.wa.sendMessage(tenantId, phone, content, leadId);
    } catch (error) {
      console.warn('[WhatsAppBotAdapter] WhatsApp API send failed (message saved to DB):', (error as Error).message);
      // Don't throw — message is already persisted
    }
  }

  /**
   * Updates a lead with scoring and classification fields.
   */
  async updateLead(leadId: string, updates: Partial<LeadUpdate>): Promise<void> {
    try {
      const setFields: Record<string, unknown> = { updatedBy: 'whatsapp-bot' };

      if (updates.score !== undefined) setFields.score = updates.score;
      if (updates.temperature !== undefined) setFields.temperature = updates.temperature;
      if (updates.inquiryReason !== undefined) setFields.inquiryReason = updates.inquiryReason;
      if (updates.customerType !== undefined) setFields.customerType = updates.customerType;
      if (updates.isB2B !== undefined) setFields.isB2B = updates.isB2B;
      if (updates.scoringBreakdown !== undefined) setFields.scoringBreakdown = updates.scoringBreakdown;
      if (updates.notes !== undefined) setFields.notes = updates.notes;
      if (updates.status !== undefined) setFields.status = updates.status;

      await LeadModel.findByIdAndUpdate(
        new Types.ObjectId(leadId),
        { $set: setFields },
        { new: true }
      );
    } catch (error) {
      console.error('[WhatsAppBotAdapter] Error updating lead:', error);
      throw error;
    }
  }

  /**
   * Triggers a handoff: marks the conversation and creates a timeline event.
   */
  async triggerHandoff(
    conversationId: string,
    reason: string,
    priority: string,
    tenantId: string
  ): Promise<void> {
    try {
      const conversation = await ConversationModel.findById(
        new Types.ObjectId(conversationId)
      );

      if (!conversation) {
        console.error(`[WhatsAppBotAdapter] Conversation not found: ${conversationId}`);
        return;
      }

      await TimelineEventModel.create({
        tenantId: new Types.ObjectId(tenantId),
        entityType: 'lead',
        entityId: conversation.leadId,
        leadId: conversation.leadId,
        eventType: 'note.added',
        title: 'Handoff a humano solicitado',
        description: `Razón: ${reason}. Prioridad: ${priority}`,
        performedBy: new Types.ObjectId('000000000000000000000001'),
        metadata: { source: 'whatsapp-bot', reason, priority, conversationId },
      });
    } catch (error) {
      console.error('[WhatsAppBotAdapter] Error triggering handoff:', error);
      throw error;
    }
  }

  /**
   * Closes a conversation by setting state to 'closed' and closedAt.
   */
  async closeConversation(conversationId: string): Promise<void> {
    try {
      await ConversationModel.findByIdAndUpdate(
        new Types.ObjectId(conversationId),
        {
          $set: {
            state: 'closed' as ConversationState,
            closedAt: new Date(),
          },
        }
      );
    } catch (error) {
      console.error('[WhatsAppBotAdapter] Error closing conversation:', error);
      throw error;
    }
  }

  /**
   * Handles domain events by creating timeline entries.
   */
  private async handleDomainEvent(
    event: LeadContactEstablished,
    tenantId: string
  ): Promise<void> {
    try {
      await TimelineEventModel.create({
        tenantId: new Types.ObjectId(tenantId),
        entityType: 'lead',
        entityId: new Types.ObjectId(event.leadId),
        leadId: new Types.ObjectId(event.leadId),
        eventType: 'note.added',
        title: 'Contacto establecido',
        description: `Lead respondió con datos reales por primera vez (trigger: ${event.trigger})`,
        performedBy: new Types.ObjectId('000000000000000000000001'),
        metadata: { source: 'whatsapp-bot', event: event.type, trigger: event.trigger },
      });
    } catch (error) {
      console.error('[WhatsAppBotAdapter] Error handling domain event:', error);
      // Don't throw — event handling is non-critical
    }
  }
}
