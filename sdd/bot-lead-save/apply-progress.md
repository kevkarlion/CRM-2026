# SDD: bot-lead-save - Apply Progress

## Status: IN_PROGRESS

## Completed Tasks

- [x] 1. Lead Types - Add profileName, address, locality, province, priority to ILead interface
- [x] 2. Lead Schema - Add new fields after temperature
- [x] 3. ConversationContext - Add profileName to interface
- [x] 4. BotMessageHandler - Accept profileName parameter in handleIncoming
- [x] 5. HandleIncomingMessageUseCase - Pass profileName to mergeContext
- [x] 6. Webhook Integration - Pass pushName to BotMessageHandler.handleIncoming()
- [x] 7. WhatsApp Service - Update lead with captured data on conversation complete

## Files Changed

- src/leads/types/lead.ts
- src/leads/schemas/lead.ts
- src/conversation/domain/conversation.ts
- src/conversation/infrastructure/bot-message-handler.ts
- src/conversation/application/handle-incoming-message.ts
- src/conversation/infrastructure/webhook-integration.ts
- src/crm/services/whatsapp.service.ts

## Implementation Details

1. Added new fields to Lead: profileName, address, locality, province, priority
2. Added profileName to ConversationContext interface
3. Pass pushName (WhatsApp profile name) through the bot pipeline
4. On conversation complete, update lead with:
   - name (from profileName or userName)
   - profileName (if empty)
   - locality (from location)
   - priority (from urgency)
   - status = 'contacted'
   - notes appended with conversation summary
   - updatedBy = 'whatsapp-bot'