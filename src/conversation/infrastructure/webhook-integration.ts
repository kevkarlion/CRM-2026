import { Types } from 'mongoose';
import LeadModel from '@/leads/models/lead';
import ConversationModel from '../models/conversation';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import { BotMessageHandler } from './bot-message-handler';
import { WhatsAppBotAdapter } from './whatsapp-adapter';
import type { BotAction } from '../application/types';
import { calculateLeadScore } from '@/leads/services/lead-score.service';
import { normalizePhone, phoneMatchQuery } from '@/lib/phone';

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
  const normalizedPhone = normalizePhone(phone);

  const existing = await LeadModel.findOne({
    tenantId: new Types.ObjectId(tenantId),
    phone: phoneMatchQuery(normalizedPhone),
    deletedAt: null,
  });

  if (existing) {
    // Si el lead estaba resuelto/descalificado, reactivarlo
    if (existing.status === 'disqualified') {
      await LeadModel.findByIdAndUpdate(existing._id, {
        $set: {
          status: 'contacted',
          qualificationStatus: 'pending',
          updatedBy: 'whatsapp-bot',
        },
      });
    }
    return { leadId: String(existing._id), isNew: false };
  }

  const newLead = await LeadModel.create({
    tenantId: new Types.ObjectId(tenantId),
    name: pushName || `Lead WhatsApp ${normalizedPhone.slice(-4)}`,
    profileName: pushName, // Guardar el nombre de perfil de WhatsApp
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
  console.log('[WebhookIntegration] findOrCreateLead result - leadId:', leadId, '| isNew:', isNew);

  // 2. Save inbound message
  await saveInboundMessage(tenantId, phone, messageContent, leadId, messageId);

  // 2.1. Check if conversation is controlled by OPERATOR - if so, skip bot
  // Primero buscar conversación activa
  console.log('[WebhookIntegration] Searching conversation for leadId:', leadId);
  let conversation = await ConversationModel.findOne({
    tenantId: new Types.ObjectId(tenantId),
    leadId: new Types.ObjectId(leadId),
    state: { $nin: ['closed', 'timeout'] },
  }).sort({ lastMessageAt: -1 });

  // Si no hay activa, buscar la última aunque esté cerrada (para verificar si operador la tenía)
  if (!conversation) {
    conversation = await ConversationModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      leadId: new Types.ObjectId(leadId),
    }).sort({ lastMessageAt: -1 });
  }

  console.log('[WebhookIntegration] Found conversation for leadId:', conversation?._id, '| owner:', conversation?.owner, '| state:', conversation?.state, '| closedAt:', conversation?.closedAt);

  // Si el operador tiene el control O si fue atendida por operador recientemente, skip bot
  if (conversation && conversation.owner === 'OPERATOR') {
    console.log('[WebhookIntegration] Conversation owned by OPERATOR, skipping bot');
    return {
      success: true,
      actions: [],
      leadId,
      conversationId: String(conversation._id),
      replyContent: undefined, // No reply from bot - operator will respond manually
    };
  }

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

  // 4.1. Handle domain events: LeadFlowCompleted → mark as contacted
  const flowCompletedEvent = actions.find(
    (a) => a.type === 'emit_domain_event' && a.event.type === 'LeadFlowCompleted'
  );
  if (flowCompletedEvent && flowCompletedEvent.type === 'emit_domain_event') {
    try {
      const event = flowCompletedEvent.event as any;
      
      // Get lead data for scoring
      const lead = await LeadModel.findById(leadId);
      console.log('[WebhookIntegration] LeadFlowCompleted for:', {
        leadId,
        inquiryReason: lead?.inquiryReason,
        priority: event.context?.urgency,
        customerType: lead?.customerType,
        isB2B: lead?.isB2B,
        currentStatus: lead?.status
      });
      
      if (lead) {
        // Calculate score based on lead data + collected context
        const { score, temperature, breakdown } = calculateLeadScore({
          inquiryReason: event.context?.needType as any || lead.inquiryReason as any,
          priority: event.context?.urgency as any || lead.priority as any,
          customerType: event.context?.customerType as any || lead.customerType as any,
          isB2B: lead.isB2B,
        });

        console.log('[WebhookIntegration] Marking lead as contacted (flow completed):', { score, temperature });

        await LeadModel.findByIdAndUpdate(
          leadId,
          { 
            $set: { 
              status: 'contacted', 
              score,
              temperature,
              scoringBreakdown: breakdown,
              // Also update lead fields from collected context
              inquiryReason: event.context?.needType || lead.inquiryReason,
              priority: event.context?.urgency || lead.priority,
              location: event.context?.location,
              // Si el usuario proporcionó un nombre diferente, usarlo; si no, preservar el profileName existente
              name: (event.context?.userName && event.context?.userName !== lead.name) 
                ? event.context?.userName 
                : (lead.name || event.context?.userName),
              profileName: event.context?.profileName || lead.profileName,
              updatedBy: 'whatsapp-bot' 
            } 
          },
          { new: true }
        );
      }
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
