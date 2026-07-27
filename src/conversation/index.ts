// Domain
export * from './domain/conversation';
export { ConversationStateMachine } from './domain/state-machine';
export { IntentExtractor } from './domain/intent-extractor';
export { ConversationLeadScoringService } from './domain/lead-scoring';
export { HandoffPolicy } from './domain/handoff-policy';
export { BotReplyComposer } from './domain/reply-composer';

// Application
export { HandleIncomingMessageUseCase } from './application/handle-incoming-message';
export type { HandleIncomingMessageInput, HandleIncomingMessageDeps } from './application/handle-incoming-message';
export { ConversationService } from './application/conversation.service';
export type { Conversation, BotAction, CreateConversationInput, UpdateConversationInput, LeadUpdate } from './application/types';

// Models (for infrastructure layer to use)
export { default as ConversationModel } from './models/conversation';

// Infrastructure
export { WhatsAppBotAdapter } from './infrastructure/whatsapp-adapter';
export { BotMessageHandler } from './infrastructure/bot-message-handler';
export { processWhatsAppWebhookMessage } from './infrastructure/webhook-integration';
export { ConversationQueryService } from './infrastructure/conversation-query.service';
export type { WebhookMessageInput, WebhookProcessResult, HandleIncomingResult, ConversationWithLead, ConversationDetail } from './infrastructure';
