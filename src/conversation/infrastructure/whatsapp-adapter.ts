import { Types } from 'mongoose';
import whatsappService from '@/crm/services/whatsapp.service';
import LeadModel from '@/leads/models/lead';
import ClientModel from '@/crm/models/client';
import ConversationModel from '../models/conversation';
import TimelineEventModel from '@/timeline/models/timeline-event';
import type { BotAction, LeadUpdate, ClientUpdate, ConversationUpdate, GestionUpdate } from '../application/types';
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
        case 'update_client':
          await this.updateClient(action.clientId, action.updates);
          break;
        // case 'update_gestion_for_client': // REMOVIDO - la gestión se crea cuando usuario hace click en "Resuelto"
        //   await this.updateGestionForClient(action.leadId, action.updates);
        //   break;
        case 'update_conversation':
          await this.updateConversation(action.conversationId, action.updates);
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
    * Sends a WhatsApp text message.
    * The message is persisted by whatsappService.sendMessage() - no need to double-save.
    */
  async sendMessage(
    content: string,
    phone: string,
    tenantId: string,
    leadId?: string
  ): Promise<void> {
    // Send via WhatsApp API (whatsappService.saveMessage() will persist it)
    try {
      await this.wa.sendMessage(tenantId, phone, content, leadId);
    } catch (error) {
      console.warn('[WhatsAppBotAdapter] WhatsApp API send failed:', (error as Error).message);
      // Don't throw - we already handle the failure in the service
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
      if (updates.address !== undefined) setFields.address = updates.address;
      if (updates.locality !== undefined) setFields.locality = updates.locality;
      if (updates.province !== undefined) setFields.province = updates.province;

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
   * Updates a client with scoring and classification fields.
   */
  async updateClient(clientId: string, updates: Partial<ClientUpdate>): Promise<void> {
    try {
      const setFields: Record<string, unknown> = { updatedBy: 'whatsapp-bot' };

      if (updates.score !== undefined) setFields.score = updates.score;
      if (updates.temperature !== undefined) setFields.temperature = updates.temperature;
      if (updates.operationStatus !== undefined) setFields.operationStatus = updates.operationStatus;
      if (updates.priority !== undefined) setFields.priority = updates.priority;
      if (updates.address !== undefined) setFields.address = updates.address;
      if (updates.locality !== undefined) setFields.locality = updates.locality;
      if (updates.province !== undefined) setFields.province = updates.province;

      await ClientModel.findByIdAndUpdate(
        new Types.ObjectId(clientId),
        { $set: setFields },
        { new: true }
      );
      
      console.log('[WhatsAppBotAdapter] Client updated:', clientId, setFields);
    } catch (error) {
      console.error('[WhatsAppBotAdapter] Error updating client:', error);
      throw error;
    }
  }

  /**
   * Updates a Gestion for a client when bot finishes scoring.
   * Finds the active Gestion for the lead that was won and updates it.
   */
  async updateGestionForClient(leadId: string, updates: Partial<GestionUpdate>): Promise<void> {
    try {
      const { GestionModel } = await import('@/gestion/models/gestion');
      
      // Find the Gestion that was created from this lead (has originalLeadId)
      const gestion = await GestionModel.findOne({
        originalLeadId: new Types.ObjectId(leadId),
        status: 'new', // Only update if still in 'new' status
        deletedAt: null,
      });

      if (!gestion) {
        console.log('[WhatsAppBotAdapter] No active Gestion found for lead:', leadId);
        return;
      }

      const setFields: Record<string, unknown> = { updatedBy: 'whatsapp-bot' };

      if (updates.score !== undefined) setFields.score = updates.score;
      if (updates.temperature !== undefined) setFields.temperature = updates.temperature;
      if (updates.inquiryReason !== undefined) setFields.inquiryReason = updates.inquiryReason;
      if (updates.status !== undefined) setFields.status = updates.status;
      if (updates.priority !== undefined) setFields.priority = updates.priority;

      await GestionModel.findByIdAndUpdate(
        gestion._id,
        { $set: setFields },
        { new: true }
      );
      
      console.log('[WhatsAppBotAdapter] Gestion updated:', gestion._id, setFields);
    } catch (error) {
      console.error('[WhatsAppBotAdapter] Error updating gestion:', error);
      // Don't throw - this is a non-critical update
    }
  }

  /**
   * Updates a conversation (customer) with scoring and classification fields.
   */
  async updateConversation(conversationId: string, updates: Partial<ConversationUpdate>): Promise<void> {
    try {
      const setFields: Record<string, unknown> = { updatedAt: new Date() };

      if (updates.score !== undefined) setFields.score = updates.score;
      if (updates.temperature !== undefined) setFields.temperature = updates.temperature;

      await ConversationModel.findByIdAndUpdate(
        new Types.ObjectId(conversationId),
        { $set: setFields },
        { new: true }
      );
    } catch (error) {
      console.error('[WhatsAppBotAdapter] Error updating conversation:', error);
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
