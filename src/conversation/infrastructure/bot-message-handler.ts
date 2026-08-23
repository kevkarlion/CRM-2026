import { Types } from 'mongoose';
import { ConversationStateMachine } from '../domain/state-machine';
import { IntentExtractor } from '../domain/intent-extractor';
import { ConversationLeadScoringService } from '../domain/lead-scoring';
import { HandoffPolicy } from '../domain/handoff-policy';
import { BotReplyComposer } from '../domain/reply-composer';
import { ConversationService } from '../application/conversation.service';
import { HandleIncomingMessageUseCase } from '../application/handle-incoming-message';
import type { BotAction } from '../application/types';
import LeadModel from '@/leads/models/lead';
import ClientModel from '@/crm/models/client';

export interface HandleIncomingResult {
  actions: BotAction[];
  conversationId?: string;
}

export class BotMessageHandler {
  private readonly useCase: HandleIncomingMessageUseCase;

  constructor() {
    const stateMachine = new ConversationStateMachine();
    const intentExtractor = new IntentExtractor();
    const scoringService = new ConversationLeadScoringService();
    const handoffPolicy = new HandoffPolicy();
    const replyComposer = new BotReplyComposer();
    const conversationService = new ConversationService();

    this.useCase = new HandleIncomingMessageUseCase({
      stateMachine,
      intentExtractor,
      scoringService,
      handoffPolicy,
      replyComposer,
      conversationService,
    });
  }

  /**
   * Checks if the lead has been converted to a client
   */
  private async isClient(leadId: string): Promise<boolean> {
    try {
      const lead = await LeadModel.findById(leadId).lean();
      return !!(lead && lead.convertedToClient);
    } catch {
      return false;
    }
  }

  /**
   * Gets the clientId if the lead has been converted
   */
  private async getClientId(leadId: string): Promise<string | null> {
    try {
      const lead = await LeadModel.findById(leadId).lean();
      return lead?.convertedToClient ? String(lead.convertedToClient) : null;
    } catch {
      return null;
    }
  }

  /**
   * Processes an incoming WhatsApp message through the full bot pipeline.
   * Returns the list of BotActions to execute.
   */
  async handleIncoming(
    tenantId: string,
    leadId: string,
    clientId: string,
    phone: string,
    messageContent: string,
    profileName?: string
  ): Promise<HandleIncomingResult> {
    try {
      const actions = await this.useCase.execute({
        tenantId,
        leadId,
        clientId,
        phone,
        messageContent,
        profileName,
      });

      // Check if this is a converted client and add update_client action if needed
      const isClient = await this.isClient(leadId);
      const clientId = await this.getClientId(leadId);

      // If it's a client and there's a scoring action for lead, also update client
      if (isClient && clientId) {
        const leadUpdateAction = actions.find(a => a.type === 'update_lead');
        if (leadUpdateAction && leadUpdateAction.type === 'update_lead') {
          // Add update_client action with same scoring data
          actions.push({
            type: 'update_client',
            clientId: clientId,
            updates: {
              score: leadUpdateAction.updates.score,
              temperature: leadUpdateAction.updates.temperature,
              operationStatus: 'quote_pending', // Client is actively interacting
            },
          });
        }
      }

      // Extract conversationId from actions if available
      const handoffAction = actions.find(a => a.type === 'trigger_handoff');
      const closeAction = actions.find(a => a.type === 'close_conversation');
      const conversationId = handoffAction?.conversationId ?? closeAction?.conversationId;

      return { actions, conversationId };
    } catch (error) {
      console.error('[BotMessageHandler] Error processing message:', error);
      throw error;
    }
  }
}
