import { Types } from 'mongoose';
import WhatsAppMessageModel from '../models/whatsapp-message';
import LeadModel from '../../leads/models/lead';
import TenantModel from '../../core/models/tenant';
import connectDB from '@/core/db';
import type { 
  IWhatsAppMessage, 
  CreateWhatsAppMessageInput,
  WhatsAppMessageDirection,
  WhatsAppMessageType 
} from '../types/whatsapp-message';
import type { ILead } from '../../leads/types/lead';

// Conversation Engine imports
import {
  ConversationEngine,
  ConversationContext,
  TransitionPolicy,
  StateRegistry,
  EngineReplyComposer,
  getDefaultFlow,
  ConversationStore,
} from '@/conversation';

/**
 * In-memory conversation store for the engine
 * Uses a Map keyed by normalized phone number
 */
class MemoryConversationStore implements ConversationStore {
  private store = new Map<string, ConversationContext>();

  async get(phoneNumber: string): Promise<ConversationContext | null> {
    return this.store.get(phoneNumber) ?? null;
  }

  async save(phoneNumber: string, context: ConversationContext): Promise<void> {
    this.store.set(phoneNumber, context);
  }

  async delete(phoneNumber: string): Promise<void> {
    this.store.delete(phoneNumber);
  }

  /**
   * Clear conversation for a phone number (for timeouts)
   */
  async clear(phoneNumber: string): Promise<void> {
    this.store.delete(phoneNumber);
  }

  /**
   * Check if there's an active conversation for a phone number
   */
  async hasActiveConversation(phoneNumber: string): Promise<boolean> {
    const ctx = this.store.get(phoneNumber);
    if (!ctx) return false;
    return ctx.get('complete') !== true;
  }
}

// Singleton store instance
const conversationStore = new MemoryConversationStore();

/**
 * Create a configured ConversationEngine instance
 */
function createConversationEngine(): ConversationEngine {
  const flowConfig = getDefaultFlow();
  const stateRegistry = new StateRegistry();
  const transitionPolicy = new TransitionPolicy();
  const replyComposer = new EngineReplyComposer();

  const engine = new ConversationEngine({
    flowConfig,
    stateRegistry,
    transitionPolicy,
    replyComposer,
  });

  // Set the persistence store
  engine.setStore(conversationStore);

  return engine;
}

// Lazy-initialized engine instance
let conversationEngine: ConversationEngine | null = null;

function getConversationEngine(): ConversationEngine {
  if (!conversationEngine) {
    conversationEngine = createConversationEngine();
  }
  return conversationEngine;
}

// Flag para modo desarrollo sin DB
const SKIP_DB_OPERATIONS = process.env.SKIP_WHATSAPP_DB === 'true';

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

export interface ProcessMessageResult {
  message: IWhatsAppMessage;
  lead: ILead | null;
  isNewLead: boolean;
  shouldRespond: boolean;
  responseText?: string;
}

export class WhatsAppService {
  /**
   * Obtiene el tenant activo (el primero que encuentra)
   * En producción, esto vendría de la configuración del número de WhatsApp
   */
  async getActiveTenantId(): Promise<string> {
    try {
      // Ensure DB connection first
      await connectDB();

      // Timeout de 3 segundos para evitar que se quede colgado
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 3000)
      );
      
      const tenantPromise = TenantModel.findOne({ deletedAt: null }).lean();
      
      const tenant = await Promise.race([tenantPromise, timeoutPromise]) as any;
      
      if (!tenant) {
        throw new Error('No hay tenants disponibles. Ejecuta el seed primero.');
      }
      return String(tenant._id);
    } catch (error) {
      console.error('Error getting tenant:', error);
      // Fallback para desarrollo: usar un ID fijo si la DB no responde
      // IMPORTANTE: Cambiar esto en producción
      return '000000000000000000000001';
    }
  }

  /**
   * Envía un mensaje de WhatsApp a través de la API de Meta
   */
  async sendMessage(
    tenantId: string,
    to: string,
    text: string,
    leadId?: string
  ): Promise<{ message: IWhatsAppMessage; metaResponse: any }> {
    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      throw new Error('WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID no configurados');
    }

    const normalizedTo = this.normalizePhone(to);

    console.log("=== WhatsApp Send ===");
    console.log({
      phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
      to: normalizedTo,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN?.slice(0, 15) + "...",
    });

    const requestBody = {
      messaging_product: 'whatsapp',
      to: normalizedTo,
      type: 'text',
      text: { body: text },
    };
    console.log("Request body:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(
      `https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    const metaResponse = await response.json();

    if (!response.ok) {
      console.error('[WhatsApp] Error enviando mensaje:', metaResponse);
      throw new Error(metaResponse.error?.message || 'Error enviando mensaje de WhatsApp');
    }

    const waMessageId = metaResponse.messages?.[0]?.id || '';

    const message = await this.saveMessage({
      tenantId: new Types.ObjectId(tenantId),
      phone: normalizedTo,
      messageId: waMessageId,
      direction: 'outbound',
      type: 'text',
      content: text,
      ...(leadId ? { leadId: new Types.ObjectId(leadId) } : {}),
    });

    return { message, metaResponse };
  }

  /**
   * Normaliza un número de teléfono (quita espacios, guiones, código de país)
   */
  normalizePhone(phone: string): string {
    // Elimina espacios, guiones, paréntesis y el +
    return phone.replace(/[\s\-\(\)\+]/g, '').replace(/^0/, '');
  }

  /**
   * Guarda un mensaje de WhatsApp
   */
  async saveMessage(
    input: CreateWhatsAppMessageInput
  ): Promise<IWhatsAppMessage> {
    if (SKIP_DB_OPERATIONS) {
      console.log('[WhatsApp] Skip DB - Would save message:', input);
      // Return a mock message for development with fake save method
      const mockMessage = {
        _id: new Types.ObjectId(),
        ...input,
        processedAt: new Date(),
        createdAt: new Date(),
        save: async () => mockMessage,
      } as IWhatsAppMessage & { save: () => Promise<any> };
      return mockMessage;
    }
    try {
      const message = new WhatsAppMessageModel(input);
      await message.save();
      return message;
    } catch (error) {
      console.error('[WhatsApp] Error saving message:', error);
      // Return mock message on error
      const mockMessage = {
        _id: new Types.ObjectId(),
        ...input,
        processedAt: new Date(),
        createdAt: new Date(),
        save: async () => mockMessage,
      } as IWhatsAppMessage & { save: () => Promise<any> };
      return mockMessage;
    }
  }

  /**
   * Busca un lead por número de teléfono o crea uno nuevo
   */
  async findOrCreateLeadByPhone(
    tenantId: string,
    phone: string,
    messageContent?: string
  ): Promise<{ lead: ILead | null; isNew: boolean }> {
    // Ensure DB connection
    await connectDB();

    if (SKIP_DB_OPERATIONS) {
      console.log('[WhatsApp] Skip DB - Would find/create lead for:', phone);
      // Return mock lead for development with fake save method
      const mockLead = {
        _id: new Types.ObjectId(),
        tenantId: new Types.ObjectId(tenantId),
        name: `Lead WhatsApp ${phone.slice(-4)}`,
        phone,
        source: 'whatsapp',
        status: 'new',
        notes: messageContent || 'Desarrollo sin DB',
        createdBy: 'whatsapp-bot',
        updatedBy: 'whatsapp-bot',
        createdAt: new Date(),
        updatedAt: new Date(),
        save: async () => mockLead,
      } as ILead & { save: () => Promise<any> };
      return {
        lead: mockLead,
        isNew: true,
      };
    }
    
    const normalizedPhone = this.normalizePhone(phone);
    
    // Buscar lead existente por teléfono
    const existingLead = await LeadModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      phone: { $regex: new RegExp(normalizedPhone.replace(/^\+/, ''), 'i') },
      deletedAt: null,
    });

    if (existingLead) {
      return { lead: existingLead, isNew: false };
    }

    // Crear nuevo lead
    const newLead = new LeadModel({
      tenantId: new Types.ObjectId(tenantId),
      name: `Lead WhatsApp ${normalizedPhone.slice(-4)}`,
      phone: normalizedPhone,
      source: 'whatsapp',
      status: 'new',
      notes: messageContent ? `Mensaje inicial: ${messageContent}` : 'Creado desde WhatsApp',
      createdBy: 'whatsapp-bot',
      updatedBy: 'whatsapp-bot',
    });

    await newLead.save();
    return { lead: newLead, isNew: true };
  }

  /**
   * Procesa un mensaje entrante de WhatsApp
   * 1. Guarda el mensaje
   * 2. Busca o crea el lead
   * 3. Actualiza el lead si es necesario
   * 4. Genera respuesta automática (usa nuevo engine si USE_CONVERSATION_ENGINE=true)
   */
  async processIncomingMessage(
    tenantId: string,
    phone: string,
    messageId: string,
    content: string,
    messageType: WhatsAppMessageType = 'text'
  ): Promise<ProcessMessageResult> {
    
    const normalizedPhone = this.normalizePhone(phone);

    // 1. Guardar el mensaje
    const message = await this.saveMessage({
      tenantId: new Types.ObjectId(tenantId),
      phone: normalizedPhone,
      messageId,
      direction: 'inbound',
      type: messageType,
      content,
    });

    // 2. Buscar o crear lead
    const { lead, isNew } = await this.findOrCreateLeadByPhone(tenantId, phone, content);

    // 3. Actualizar lead si es nuevo o si hay información relevante
    if (lead) {
      // Actualizar el mensaje con el leadId
      message.leadId = lead._id;
      await message.save();

      // Si es nuevo lead, already tiene el notes con el mensaje inicial
      // Si ya existía, agregamos el mensaje a los notes
      if (!isNew && content) {
        const currentNotes = lead.notes || '';
        lead.notes = `${currentNotes}\n${new Date().toISOString()}: ${content}`.trim();
        await lead.save();
      }
    }

    // 4. Generar respuesta automática - siempre usar Conversation Engine
    let shouldRespond = false;
    let responseText: string | undefined;

    console.log('[WhatsApp] Using Conversation Engine');
    
    try {
      const engineResult = await this.processWithEngine(normalizedPhone, content, isNew);
      shouldRespond = true;
      responseText = engineResult.message;
      
      // If complete or handoff, we might want to handle lead status
      if (engineResult.isComplete) {
        console.log('[WhatsApp] Conversation complete, context:', engineResult.context?.data);
        // Could update lead status here if needed
      }
      
      if (engineResult.handoff) {
        console.log('[WhatsApp] Handoff to human triggered');
      }
    } catch (error) {
      console.error('[WhatsApp] Engine error:', error);
      // Fall back to simple error message
      shouldRespond = true;
      responseText = 'Estamos procesando tu solicitud. En breve un asesor se pondrá en contacto contigo. 😊';
    }

    return {
      message,
      lead,
      isNewLead: isNew,
      shouldRespond,
      responseText,
    };
  }

  /**
   * Process message using the new Conversation Engine
   * 
   * Flow:
   * 1. Check if phone has active conversation in context
   * 2. If yes, route to engine.process()
   * 3. If no, check if greeting keyword → start new conversation
   * 4. Get response from engine and return
   */
  private async processWithEngine(
    phoneNumber: string,
    input: string,
    isNewLead: boolean
  ): Promise<{ message: string; isComplete: boolean; handoff?: boolean; context?: ConversationContext }> {
    const engine = getConversationEngine();
    const normalizedInput = input.trim();
    const now = new Date();

    // Check if there's an active conversation
    const storedContext = await conversationStore.get(phoneNumber);
    const hasActive = storedContext !== null;
    
    // Check if conversation was already completed
    const isComplete = storedContext?.get('complete') === true;
    
    // Check for timeout (30 minutes) - only matters if conversation was completed
    let isTimedOut = false;
    if (hasActive && storedContext) {
      const lastActivity = storedContext.get<string>('lastActivity');
      if (lastActivity) {
        const lastTime = new Date(lastActivity);
        const diffMs = now.getTime() - lastTime.getTime();
        const diffMinutes = diffMs / (1000 * 60);
        
        // If conversation is complete and passed 30 min, restart it
        if (isComplete && diffMinutes > 30) {
          console.log('[Engine] Completed conversation timed out after', diffMinutes, 'minutes, restarting');
          isTimedOut = true;
          await conversationStore.clear(phoneNumber);
        }
      }
    }
    
    let result;
    
    if (hasActive && !isTimedOut) {
      // Check if conversation already completed - respond with processed message
      if (isComplete) {
        console.log('[Engine] Conversation already completed, sending processed message');
        return {
          message: 'Tu solicitud fue procesada, un asesor se contactará en breve. 😊',
          isComplete: true,
          context: storedContext,
        };
      }
      
      // Continue existing conversation
      console.log('[Engine] Continuing conversation for:', phoneNumber);
      result = await engine.process(phoneNumber, normalizedInput);
    } else {
      // No active conversation or timed out - start new one
      console.log('[Engine] Starting new conversation for:', phoneNumber, '| isTimedOut:', isTimedOut);
      result = await engine.start(phoneNumber);
    }

    // Update last activity timestamp
    if (result.context) {
      result.context.set('lastActivity', now.toISOString());
      await conversationStore.save(phoneNumber, result.context);
    }

    return {
      message: this.formatEngineMessage(result.message, result.options),
      isComplete: result.isComplete,
      handoff: result.handoff,
      context: result.context,
    };
  }

  /**
   * Check if the input contains a greeting keyword
   */
  private isGreetingKeyword(text: string): boolean {
    const lower = text.toLowerCase().trim();
    return (
      lower.includes('hola') ||
      lower.includes('hello') ||
      lower.includes('hi') ||
      lower.includes('buenas') ||
      lower.includes('buenos días') ||
      lower.includes('buenas tardes') ||
      lower.includes('buenas noches')
    );
  }

  /**
   * Format engine message with options if present
   */
  private formatEngineMessage(message: string, options?: string[]): string {
    if (!options || options.length === 0) {
      return message;
    }

    // Append options as numbered list
    const optionsText = options
      .map((opt, idx) => `${idx + 1}. ${opt}`)
      .join('\n');

    return `${message}\n\n${optionsText}`;
  }

  /**
   * Obtiene mensajes de WhatsApp para un lead
   */
  async getMessagesByLead(
    tenantId: string,
    leadId: string
  ): Promise<IWhatsAppMessage[]> {
    return WhatsAppMessageModel.find({
      tenantId: new Types.ObjectId(tenantId),
      leadId: new Types.ObjectId(leadId),
    }).sort({ createdAt: 1 });
  }

  /**
   * Obtiene mensajes por número de teléfono
   */
  async getMessagesByPhone(
    tenantId: string,
    phone: string
  ): Promise<IWhatsAppMessage[]> {
    return WhatsAppMessageModel.find({
      tenantId: new Types.ObjectId(tenantId),
      phone: this.normalizePhone(phone),
    }).sort({ createdAt: 1 });
  }
}

export default new WhatsAppService();