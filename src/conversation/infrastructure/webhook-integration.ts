import { Types } from 'mongoose';
import LeadModel from '@/leads/models/lead';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import { BotMessageHandler } from './bot-message-handler';
import { WhatsAppBotAdapter } from './whatsapp-adapter';
import type { BotAction } from '../application/types';

export interface WebhookMessageInput {
  tenantId: string;
  phone: string;
  messageContent: string;
  pushName?: string;
  messageId?: string;
}

export interface WebhookProcessResult {
  success: boolean;
  actions: BotAction[];
  leadId: string;
  conversationId?: string;
  replyContent?: string;
}

/**
 * Finds or creates a lead by phone number for a given tenant.
 */
async function findOrCreateLead(
  tenantId: string,
  phone: string,
  pushName?: string,
  messageContent?: string
): Promise<{ leadId: string; isNew: boolean }> {
  const normalizedPhone = phone.replace(/[\s\-\(\)\+]/g, '').replace(/^0/, '');

  const existing = await LeadModel.findOne({
    tenantId: new Types.ObjectId(tenantId),
    phone: { $regex: new RegExp(normalizedPhone.replace(/^\+/, ''), 'i') },
    deletedAt: null,
  });

  if (existing) {
    return { leadId: String(existing._id), isNew: false };
  }

  const newLead = await LeadModel.create({
    tenantId: new Types.ObjectId(tenantId),
    name: pushName || `Lead WhatsApp ${normalizedPhone.slice(-4)}`,
    phone: normalizedPhone,
    source: 'whatsapp',
    status: 'new',
    notes: messageContent ? `Mensaje inicial: ${messageContent}` : 'Creado desde WhatsApp',
    createdBy: 'whatsapp-bot',
    updatedBy: 'whatsapp-bot',
  });

  return { leadId: String(newLead._id), isNew: true };
}

/**
 * Saves an inbound WhatsApp message to the database.
 */
async function saveInboundMessage(
  tenantId: string,
  phone: string,
  content: string,
  leadId: string,
  messageId?: string
): Promise<void> {
  try {
    await WhatsAppMessageModel.create({
      tenantId: new Types.ObjectId(tenantId),
      phone,
      messageId: messageId || `wamid.bot.${Date.now()}`,
      direction: 'inbound',
      type: 'text',
      content,
      status: 'delivered',
      leadId: new Types.ObjectId(leadId),
    });
  } catch (error) {
    console.error('[WebhookIntegration] Error saving inbound message:', error);
  }
}

/**
 * Main integration point for processing a WhatsApp webhook message.
 *
 * Flow:
 * 1. Find or create lead from phone number
 * 2. Save inbound message
 * 3. Run bot pipeline (HandleIncomingMessageUseCase)
 * 4. Execute returned actions (send replies, update lead, etc.)
 * 5. Return result
 */
export async function processWhatsAppWebhookMessage(
  input: WebhookMessageInput
): Promise<WebhookProcessResult> {
  const { tenantId, phone, messageContent, pushName, messageId } = input;

  // 1. Find or create lead
  const { leadId, isNew } = await findOrCreateLead(tenantId, phone, pushName, messageContent);

  // 2. Save inbound message
  await saveInboundMessage(tenantId, phone, messageContent, leadId, messageId);

  // 3. Run bot pipeline
  const handler = new BotMessageHandler();
  const { actions, conversationId } = await handler.handleIncoming(
    tenantId,
    leadId,
    phone,
    messageContent,
    pushName
  );

  // 4. Execute actions via adapter
  if (actions.length > 0) {
    const adapter = new WhatsAppBotAdapter();
    await adapter.executeActions(actions, tenantId, phone, leadId);
  }

  // 4.1. Handle domain events: LeadContactEstablished → new → contacted
  const contactEvent = actions.find(
    (a) => a.type === 'emit_domain_event' && a.event.type === 'LeadContactEstablished'
  );
  if (contactEvent && contactEvent.type === 'emit_domain_event') {
    try {
      await LeadModel.findByIdAndUpdate(
        new Types.ObjectId(leadId),
        { $set: { status: 'contacted', updatedBy: 'whatsapp-bot' } },
        { new: true }
      );
    } catch (error) {
      console.error('[WebhookIntegration] Error updating lead to contacted:', error);
    }
  }

  // 5. Extract reply content for webhook response
  const replyAction = actions.find(a => a.type === 'send_message');

  return {
    success: true,
    actions,
    leadId,
    conversationId,
    replyContent: replyAction?.content,
  };
}
