import { ConversationStateMachine } from '../domain/state-machine';
import { IntentExtractor } from '../domain/intent-extractor';
import { ConversationLeadScoringService } from '../domain/lead-scoring';
import { HandoffPolicy } from '../domain/handoff-policy';
import { BotReplyComposer } from '../domain/reply-composer';
import { ConversationService } from '../application/conversation.service';
import { HandleIncomingMessageUseCase } from '../application/handle-incoming-message';
import type { BotAction } from '../application/types';

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
   * Processes an incoming WhatsApp message through the full bot pipeline.
   * Returns the list of BotActions to execute.
   */
  async handleIncoming(
    tenantId: string,
    leadId: string,
    phone: string,
    messageContent: string,
    profileName?: string
  ): Promise<HandleIncomingResult> {
    try {
      const actions = await this.useCase.execute({
        tenantId,
        leadId,
        phone,
        messageContent,
        profileName,
      });

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
