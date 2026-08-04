// Domain
export * from './domain/conversation';
export { ConversationStateMachine } from './domain/state-machine';
export { IntentExtractor } from './domain/intent-extractor';
export { ConversationLeadScoringService } from './domain/lead-scoring';
export { HandoffPolicy } from './domain/handoff-policy';
export { BotReplyComposer } from './domain/reply-composer';

// Reply Composer (Engine-compatible)
export { EngineReplyComposer } from './composer';
export type { BotReply } from './composer';

// Conversation Engine - New Architecture (Batch 1)
export { ConversationContext } from './context';
export * from './types';
export * from './states/interface';
export { ConversationEngine } from './engine';
export type { ConversationEngineOptions, ReplyComposer, ConversationStore } from './engine';
export { TransitionPolicy } from './policy';
export type { TransitionPolicyOptions } from './policy';

// Conversation States (Batch 2)
export * from './states';
export * from './config';

// Application
export { HandleIncomingMessageUseCase } from './application/handle-incoming-message';
export type { HandleIncomingMessageInput, HandleIncomingMessageDeps } from './application/handle-incoming-message';
export { ConversationService } from './application/conversation.service';
export type { Conversation, BotAction, CreateConversationInput, UpdateConversationInput, LeadUpdate } from './application/types';
export { conversationResolver, ConversationResolver } from './application/conversation-resolver';
export type { ResolvedConversation, WaitingOperatorEvent } from './application/conversation-resolver';
export { WaitingPriority } from './application/conversation-resolver';

// Flow Selector
export { selectFlow } from './flow-selector';

// Models (for infrastructure layer to use)
export { default as ConversationModel } from './models/conversation';

// Infrastructure
export { WhatsAppBotAdapter } from './infrastructure/whatsapp-adapter';
export { BotMessageHandler } from './infrastructure/bot-message-handler';
export { processWhatsAppWebhookMessage } from './infrastructure/webhook-integration';
export { ConversationQueryService } from './infrastructure/conversation-query.service';
export type { WebhookMessageInput, WebhookProcessResult, HandleIncomingResult, ConversationWithLead, ConversationDetail } from './infrastructure';
