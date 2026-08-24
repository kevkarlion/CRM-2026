import { Types } from 'mongoose';
import LeadModel from '@/leads/models/lead';
import ContactModel from '@/crm/models/contact';
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
  messageType?: string;
  mediaId?: string;
  caption?: string;
  filename?: string;
}

export interface WebhookProcessResult {
  success: boolean;
  actions: BotAction[];
  leadId: string;
  clientId?: string;
  entityType: 'client' | 'lead';
  conversationId?: string;
  replyContent?: string;
}

/**
 * Finds or creates a lead or client by phone number for a given tenant.
 * Priority: client (via contacts) > lead > new lead
 */
async function findOrCreateEntity(
  tenantId: string,
  phone: string,
  pushName?: string,
  messageContent?: string
): Promise<{ 
  leadId?: string; 
  clientId?: string; 
  entityType: 'client' | 'lead' | 'new';
  isNew: boolean 
}> {
  const normalizedPhone = normalizePhone(phone);

  try {
    // 1. First, search in contacts for a client (highest priority)
    const contact = await ContactModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      phone: phoneMatchQuery(normalizedPhone),
      deletedAt: null,
    }).lean();

    if (contact?.clientId) {
      console.log('[findOrCreateEntity] Found client via contact - clientId:', contact.clientId);
      return { 
        clientId: String(contact.clientId), 
        entityType: 'client', 
        isNew: false 
      };
    }
  } catch (error) {
    console.error('[findOrCreateEntity] Error searching contact:', error);
    // Continue with lead search
  }

  // 2. If no client, search in leads
  try {
    const existing = await LeadModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      phone: phoneMatchQuery(normalizedPhone),
      deletedAt: null,
    });

    if (existing) {
      console.log('[findOrCreateEntity] Found lead - leadId:', existing._id, 'status:', existing.status, 'convertedToClient:', existing.convertedToClient);
      
      // If lead was disqualified, reactivate it
      if (existing.status === 'disqualified') {
        await LeadModel.findByIdAndUpdate(existing._id, {
          $set: {
            status: 'contacted',
            qualificationStatus: 'pending',
            updatedBy: 'whatsapp-bot',
          },
        });
      }
      
      return { 
        leadId: String(existing._id), 
        entityType: 'lead', 
        isNew: false 
      };
    }
  } catch (error) {
    console.error('[findOrCreateEntity] Error searching lead:', error);
    // Continue to create new lead
  }

  // 3. If no client or lead, create new lead
  console.log('[findOrCreateEntity] Creating new lead for phone:', normalizedPhone);
  
  const newLead = await LeadModel.create({
    tenantId: new Types.ObjectId(tenantId),
    name: pushName || `Lead WhatsApp ${normalizedPhone.slice(-4)}`,
    profileName: pushName,
    phone: normalizedPhone,
    source: 'whatsapp',
    status: 'new',
    notes: messageContent ? `Mensaje inicial: ${messageContent}` : 'Creado desde WhatsApp',
    createdBy: 'whatsapp-bot',
    updatedBy: 'whatsapp-bot',
  });

  return { 
    leadId: String(newLead._id), 
    entityType: 'new', 
    isNew: true 
  };
}

/**
 * Saves an inbound WhatsApp message to the database.
 */
async function saveInboundMessage(
  tenantId: string,
  phone: string,
  content: string,
  leadId: string | undefined,
  messageId?: string,
  messageType?: string,
  mediaId?: string,
  caption?: string,
  filename?: string
): Promise<void> {
  try {
    // Only save if we have a valid leadId
    // For clients (where leadId is undefined), we skip saving the message to lead
    if (!leadId) {
      console.log('[WebhookIntegration] Skipping message save - no leadId (client conversation)');
      return;
    }
    
    await WhatsAppMessageModel.create({
      tenantId: new Types.ObjectId(tenantId),
      phone,
      messageId: messageId || `wamid.bot.${Date.now()}`,
      direction: 'inbound',
      type: messageType || 'text',
      content,
      status: 'delivered',
      leadId: new Types.ObjectId(leadId),
      metadata: mediaId ? { mediaId, caption, filename } : undefined,
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
  const { tenantId, phone, messageContent, pushName, messageId, messageType, mediaId, caption, filename } = input;

  // 1. Find or create entity (client priority > lead > new lead)
  const entity = await findOrCreateEntity(tenantId, phone, pushName, messageContent);
  const { leadId, clientId, entityType, isNew } = entity;
  
  console.log('[WebhookIntegration] findOrCreateEntity result - entityType:', entityType, '| clientId:', clientId, '| leadId:', leadId, '| isNew:', isNew);

  // 2. Save inbound message - solo para leads, no para clientes
  // Para clientes (clientId definido), no guardamos en WhatsAppMessage
  if (leadId) {
    await saveInboundMessage(tenantId, phone, messageContent, leadId, messageId, messageType, mediaId, caption, filename);
  } else {
    console.log('[WebhookIntegration] Skipping message save - client or new entity');
  }

  // 2.1. Buscar conversación por teléfono (método seguro y robusto)
  // Primero intentamos por teléfono, que es el identificador natural de WhatsApp
  // Esto encuentra tanto conversaciones de leads como de clientes (ya migradas)
  let conversation = null;
  let conversationFoundBy = '';

  try {
    // Normalizar teléfono para búsqueda
    const normalizedPhone = normalizePhone(phone);
    console.log('[WebhookIntegration] Buscando conversación por teléfono:', normalizedPhone);

    // Extraer los últimos 10 dígitos para búsqueda flexible (ignora código de país)
    // ej: 5492984252859 -> 2984252859
    const last10Digits = normalizedPhone.replace(/^\d{2,3}/, ''); //去除前2-3位（国家代码）
    console.log('[WebhookIntegration] Búsqueda por últimos 10 dígitos:', last10Digits);

    // Estrategia de búsqueda:
    // 1. Exact match (caso ya normalizado igual)
    // 2. Regex por últimos 10 dígitos (ignora código de país)
    const phoneQuery = {
      tenantId: new Types.ObjectId(tenantId),
      $or: [
        { phoneNumber: normalizedPhone },
        { phoneNumber: { $regex: `${last10Digits}$`, $options: '' } }, // ends with
      ],
    };

    // Buscar conversación activa por teléfono
    conversation = await ConversationModel.findOne({
      ...phoneQuery,
      state: { $nin: ['closed', 'timeout'] },
    }).sort({ lastMessageAt: -1 });

    if (conversation) {
      conversationFoundBy = 'phone-active';
      console.log('[WebhookIntegration] Conversación activa encontrada por teléfono:', {
        conversationId: conversation._id,
        conversationType: conversation.conversationType,
        lifecycleState: conversation.lifecycleState,
        clientId: conversation.clientId,
        leadId: conversation.leadId,
        owner: conversation.owner,
        state: conversation.state,
        phoneNumber: conversation.phoneNumber,
      });
    } else {
      // Si no hay activa, buscar cualquier conversación por teléfono (para verificar si operador la tenía)
      conversation = await ConversationModel.findOne(phoneQuery).sort({ lastMessageAt: -1 });

      if (conversation) {
        conversationFoundBy = 'phone-any';
        console.log('[WebhookIntegration] Conversación (cualquier estado) encontrada por teléfono:', {
          conversationId: conversation._id,
          conversationId: conversation._id,
          conversationType: conversation.conversationType,
          lifecycleState: conversation.lifecycleState,
          clientId: conversation.clientId,
          leadId: conversation.leadId,
          owner: conversation.owner,
          state: conversation.state,
          closedAt: conversation.closedAt,
        });
      } else {
        console.log('[WebhookIntegration] No se encontró conversación por teléfono:', normalizedPhone);
      }
    }
  } catch (error) {
    console.error('[WebhookIntegration] Error buscando conversación por teléfono:', error);
    // No lanzamos el error, continuamos con búsqueda por leadId como fallback
  }

  // Fallback: si no se encontró por teléfono, buscar por leadId (lógica original)
  if (!conversation) {
    try {
      console.log('[WebhookIntegration] Buscando conversación por leadId (fallback):', leadId);
      
      conversation = await ConversationModel.findOne({
        tenantId: new Types.ObjectId(tenantId),
        leadId: new Types.ObjectId(leadId),
        state: { $nin: ['closed', 'timeout'] },
      }).sort({ lastMessageAt: -1 });

      if (conversation) {
        conversationFoundBy = 'leadId-active';
        console.log('[WebhookIntegration] Conversación activa encontrada por leadId:', {
          conversationId: conversation._id,
          conversationType: conversation.conversationType,
          lifecycleState: conversation.lifecycleState,
          leadId: conversation.leadId,
        });
      } else {
        // Buscar la última aunque esté cerrada
        conversation = await ConversationModel.findOne({
          tenantId: new Types.ObjectId(tenantId),
          leadId: new Types.ObjectId(leadId),
        }).sort({ lastMessageAt: -1 });

        if (conversation) {
          conversationFoundBy = 'leadId-any';
          console.log('[WebhookIntegration] Conversación (cualquier estado) encontrada por leadId:', {
            conversationId: conversation._id,
            conversationType: conversation.conversationType,
            state: conversation.state,
          });
        }
      }
    } catch (error) {
      console.error('[WebhookIntegration] Error buscando conversación por leadId:', error);
    }
  }

  console.log('[WebhookIntegration] Conversación final:', {
    foundBy: conversationFoundBy,
    conversationId: conversation?._id,
    conversationType: conversation?.conversationType,
    lifecycleState: conversation?.lifecycleState,
    owner: conversation?.owner,
    state: conversation?.state,
  });

  // Si es cliente y la conversación no tiene clientId, actualizarlo
  // También cargar datos del cliente (dirección) si no están en el contexto
  // Usar engineData.clientId como fallback porque puede estar ahí pero no en el campo principal
  const effectiveClientId = clientId || (conversation?.engineData as any)?.clientId;
  if (conversation && effectiveClientId) {
    // Import ClientModel here to avoid circular deps
    const { default: ClientModel } = await import('@/crm/models/client');
    
    // Cargar datos del cliente
    let clientData: { fullName?: string; address?: string; locality?: string; province?: string } | null = null;
    try {
      clientData = await ClientModel.findById(effectiveClientId).lean() as typeof clientData;
    } catch (e) {
      console.error('[WebhookIntegration] Error loading client data:', e);
    }

    const updates: any = {};
    if (!conversation.clientId) {
      updates.clientId = new Types.ObjectId(effectiveClientId);
      updates['context.clientId'] = effectiveClientId;
      updates['context.isCustomer'] = true;
    }

    // Agregar datos del cliente al contexto si no están
    if (clientData?.fullName && !conversation.context?.customerName) {
      updates['context.customerName'] = clientData.fullName;
    }
    if (clientData?.address && !conversation.context?.customerAddress) {
      updates['context.customerAddress'] = clientData.address;
    }
    if (clientData?.locality && !conversation.context?.customerLocality) {
      updates['context.customerLocality'] = clientData.locality;
    }
    if (clientData?.province && !conversation.context?.customerProvince) {
      updates['context.customerProvince'] = clientData.province;
    }

    if (Object.keys(updates).length > 0) {
      try {
        await ConversationModel.updateOne({ _id: conversation._id }, { $set: updates });
        console.log('[WebhookIntegration] Updated conversation with client data:', Object.keys(updates));
        
        // Recargar conversación para que tenga los datos frescos
        conversation = await ConversationModel.findById(conversation._id).lean();
      } catch (e) {
        console.error('[WebhookIntegration] Error updating conversation:', e);
      }
    }
  }

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
    entityType === 'client' ? undefined : leadId,  // undefined si es cliente
    entityType === 'client' ? clientId : undefined, // undefined si es lead
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
    leadId: leadId || '',
    clientId,
    entityType: entityType as 'client' | 'lead',
    conversationId,
    replyContent: replyAction?.content,
  };
}
