import { Types } from 'mongoose';
import WhatsAppMessageModel from '../models/whatsapp-message';
import LeadModel from '../../leads/models/lead';
import ClientModel from '../models/client';
import TenantModel from '../../core/models/tenant';
import { ClientServiceHistoryModel } from '@/clients';
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
  selectFlow,
  conversationResolver,
} from '@/conversation';
import ConversationModel from '@/conversation/models/conversation';

/**
 * MongoDB-backed conversation store for the engine
 * Persists conversations in MongoDB to survive server restarts
 */
class MongoDBConversationStore implements ConversationStore {
  async get(phoneNumber: string): Promise<ConversationContext | null> {
    try {
      await connectDB();
      
      // Find ACTIVE conversation only (not closed, not expired)
      const doc = await ConversationModel.findOne({ 
        phoneNumber,
        lifecycleState: 'ACTIVE',
      }).lean();
      
      if (!doc) {
        console.log('[Store] No ACTIVE document found for', phoneNumber);
        return null;
      }
      
      console.log('[Store] === FULL DOC DEBUG ===');
      console.log('[Store] _id:', doc._id);
      console.log('[Store] lifecycleState:', doc.lifecycleState);
      console.log('[Store] state:', doc.state);
      console.log('[Store] engineData:', JSON.stringify(doc.engineData));
      console.log('[Store] lastActivityAt:', doc.lastActivityAt);
      console.log('[Store] expiresAt:', doc.expiresAt);
      console.log('[Store] =========================');
      
      // Check if conversation has expired
      if (doc.expiresAt && new Date() > doc.expiresAt) {
        console.log('[Store] Conversation expired, marking as EXPIRED');
        await ConversationModel.findByIdAndUpdate(doc._id, {
          $set: { lifecycleState: 'EXPIRED', closedAt: new Date() }
        });
        return null;
      }
      
      // Reconstruct context from stored data
      const context = new ConversationContext(phoneNumber);
      if (doc.engineData) {
        // doc.engineData contains: { currentState: "service", customerName: "...", etc. }
        for (const [key, value] of Object.entries(doc.engineData)) {
          context.set(key, value);
        }
      }
      console.log('[Store] Reconstructed currentState:', context.get('currentState'));
      return context;
    } catch (error) {
      console.error('[Store] Error getting conversation:', error);
      return null;
    }
  }

  async save(phoneNumber: string, context: ConversationContext): Promise<void> {
    try {
      await connectDB();
      const contextData = context.toJSON();
      const now = new Date();
      
      console.log('[Store] === SAVE DEBUG ===');
      console.log('[Store] Saving for:', phoneNumber);
      console.log('[Store] contextData.data:', JSON.stringify(contextData.data));
      console.log('[Store] =========================');
      
      // Find existing ACTIVE conversation for this phone
      const existing = await ConversationModel.findOne({
        phoneNumber,
        lifecycleState: 'ACTIVE',
      });
      
      if (existing) {
        // Update existing conversation
        await ConversationModel.findByIdAndUpdate(existing._id, {
          $set: {
            engineData: contextData.data,
            lastActivityAt: now,
            lastMessageAt: now,
            updatedAt: now,
          },
        });
        console.log('[Store] Updated existing ACTIVE conversation:', existing._id);
      } else {
        // Create new conversation (for new or reactivated flows)
        await ConversationModel.create({
          phoneNumber,
          engineData: contextData.data,
          context: {
            hasEmergencyKeywords: false,
            hasProjectKeywords: false,
            messageContainsData: false,
            userAskedForHuman: false,
          },
          lastActivityAt: now,
          startedAt: now,
          lastMessageAt: now,
          lifecycleState: 'ACTIVE',
        });
        console.log('[Store] Created new ACTIVE conversation for:', phoneNumber);
      }
    } catch (error) {
      console.error('[Store] Error saving conversation:', error);
    }
  }

  async delete(phoneNumber: string): Promise<void> {
    try {
      await connectDB();
      // Close ACTIVE conversations instead of deleting (preserve history)
      const result = await ConversationModel.updateMany(
        { phoneNumber, lifecycleState: 'ACTIVE' },
        { 
          $set: { 
            lifecycleState: 'CLOSED',
            closedAt: new Date(),
            updatedAt: new Date(),
          } 
        }
      );
      console.log('[Store] Closed', result.modifiedCount, 'conversations for', phoneNumber);
    } catch (error) {
      console.error('[Store] Error closing conversation:', error);
    }
  }

  async clear(phoneNumber: string): Promise<void> {
    // Close conversation instead of deleting - preserve history
    await this.delete(phoneNumber);
  }

  async markExpired(phoneNumber: string): Promise<void> {
    try {
      await connectDB();
      const result = await ConversationModel.updateMany(
        { phoneNumber, lifecycleState: { $in: ['ACTIVE', 'WAITING_OPERATOR'] } },
        { 
          $set: { 
            lifecycleState: 'EXPIRED',
            closedAt: new Date(),
            updatedAt: new Date(),
          } 
        }
      );
      console.log('[Store] Marked expired', result.modifiedCount, 'conversations for', phoneNumber);
    } catch (error) {
      console.error('[Store] Error marking expired:', error);
    }
  }

  async hasActiveConversation(phoneNumber: string): Promise<boolean> {
    const ctx = await this.get(phoneNumber);
    if (!ctx) return false;
    return ctx.get('complete') !== true;
  }
}

// Singleton store instance - MongoDB backed
const conversationStore = new MongoDBConversationStore();

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
    messageType: WhatsAppMessageType = 'text',
    profileName?: string
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
      const engineResult = await this.processWithEngine(tenantId, normalizedPhone, content, isNew);
      shouldRespond = true;
      responseText = engineResult.message;
      
      // If complete or handoff, we might want to handle lead status
      if (engineResult.isComplete) {
        console.log('[WhatsApp] Conversation complete, context:', engineResult.context?.data);
        
        // Update conversation lifecycle state to WAITING_OPERATOR using ConversationResolver
        try {
          // Find the ACTIVE conversation and mark as waiting
          const conversation = await ConversationModel.findOne({
            phoneNumber: normalizedPhone,
            lifecycleState: 'ACTIVE',
          });
          
          if (conversation) {
            await conversationResolver.markAsWaitingOperator(conversation._id.toString());
            console.log('[WhatsApp] Conversation marked as WAITING_OPERATOR');
          }
        } catch (error) {
          console.error('[WhatsApp] Error updating lifecycle state:', error);
        }
        
        // Update lead with captured data from conversation
        if (engineResult.context) {
          const contextData = engineResult.context.data;
          const profileName = contextData.profileName as string | undefined;
          const userName = contextData.userName as string | undefined;
          const customerName = contextData.customerName as string | undefined;
          const address = contextData.address as string | undefined;
          const locality = contextData.locality as string | undefined;
          const province = contextData.province as string | undefined;
          const priority = contextData.priorityLabel as string | undefined;
          const needType = contextData.serviceTypeLabel as string | undefined;
          const customerType = contextData.customerType as string | undefined;
          const description = contextData.description as string | undefined;
          
          // Find lead by phone and update
          const existingLead = await LeadModel.findOne({
            tenantId: new Types.ObjectId(tenantId),
            phone: { $regex: new RegExp(normalizedPhone.replace(/^\+/, ''), 'i') },
            deletedAt: null,
          });
          
          if (existingLead) {
            const updateData: Record<string, any> = {
              status: 'contacted',
              updatedBy: 'whatsapp-bot',
            };
            
            // Update profileName (from WhatsApp)
            const contextProfileName = contextData.profileName as string | undefined;
            if (contextProfileName) {
              updateData.profileName = contextProfileName;
            }
            
            // Update name if we have a better name
            const newName = contextProfileName || userName || customerName;
            if (newName && newName !== `Lead WhatsApp ${normalizedPhone.slice(-4)}`) {
              updateData.name = newName;
              updateData.companyName = newName;
            }
            
            // Update address fields
            if (address) {
              updateData.address = address;
            }
            if (locality) {
              updateData.locality = locality;
            }
            if (province) {
              updateData.province = province;
            }
            
            // Update priority from urgency
            if (priority) {
              updateData.priority = priority;
            }
            
            // Save bot summary as notes (service + priority + description)
            const notesParts: string[] = [];
            if (needType) notesParts.push(`Servicio: ${needType}`);
            if (priority) notesParts.push(`Necesidad: ${priority}`);
            if (description) notesParts.push(`Descripción: ${description}`);
            
            if (notesParts.length > 0) {
              // Overwrite notes with bot summary (new format)
              updateData.notes = notesParts.join(' | ');
            }
            
            await LeadModel.findByIdAndUpdate(existingLead._id, { $set: updateData });
            console.log('[WhatsApp] Lead updated with conversation data');
          }
        }
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
   * 1. Select appropriate flow based on phone (lead vs customer)
   * 2. If customer flow, initialize context with customer data
   * 3. Check if phone has active conversation in context
   * 4. If yes, route to engine.process()
   * 5. If no, start new conversation
   * 6. Get response from engine and return
   */
  private async processWithEngine(
    tenantId: string,
    phoneNumber: string,
    input: string,
    isNewLead: boolean
  ): Promise<{ message: string; isComplete: boolean; handoff?: boolean; context?: ConversationContext }> {
    console.log('[Engine] === START === phone:', phoneNumber, '| input:', input);
    
    // Ensure DB is connected
    await connectDB();
    
    const engine = getConversationEngine();
    const normalizedInput = input.trim();
    const now = new Date();

    // Step 1: Select appropriate flow based on phone
    console.log('[Engine] Selecting flow for:', phoneNumber, 'tenant:', tenantId);
    const flowConfig = await selectFlow(phoneNumber, tenantId);
    console.log('[Engine] Selected flow:', flowConfig.id);
    
    // Set flow config on engine
    engine.setFlowConfig(flowConfig);

    // Step 2: If customer flow, initialize context with customer data
    let customerData: Record<string, unknown> = {};
    if (flowConfig.id === 'customer-service') {
      try {
        const normalizedPhone = phoneNumber.replace(/[\s\-\(\)\+]/g, '').replace(/^0/, '');
        const client = await ClientModel.findOne({
          tenantId: new Types.ObjectId(tenantId),
          phone: { $regex: new RegExp(normalizedPhone.replace(/^\+/, ''), 'i') },
          deletedAt: null,
        }).lean();
        
        if (client) {
          console.log('[Engine] Customer found, initializing context');
          // Create a temporary context to extract customer data
          const tempContext = new ConversationContext(phoneNumber);
          tempContext.initializeFromCustomer(client as any);
          
          // Store customer data to apply after start
          customerData = {
            customerName: tempContext.get('customerName'),
            address: tempContext.get('address'),
            locality: tempContext.get('locality'),
            province: tempContext.get('province'),
            isCustomer: true,
            clientId: tempContext.get('clientId'),
            tenantId: tenantId,
            // Store original address for comparison when user provides new address
            originalAddress: tempContext.get('address'),
            originalLocality: tempContext.get('locality'),
            originalProvince: tempContext.get('province'),
          };
          
          console.log('[Engine] Customer data ready:', customerData);
        }
      } catch (error) {
        console.error('[Engine] Error loading customer:', error);
      }
    }

    // Step 3: Use ConversationResolver to get the right conversation
    console.log('[Engine] Resolving conversation...');
    const resolved = await conversationResolver.getConversationForIncomingMessage(
      normalizedPhone,
      tenantId,
      leadId
    );
    
    console.log('[Engine] Resolved:', {
      shouldContinue: resolved.shouldContinue,
      isWaitingForOperator: resolved.isWaitingForOperator,
      isNew: resolved.isNew,
      lifecycleState: resolved.conversation.lifecycleState,
    });
    
    // If waiting for operator, return the waiting message
    if (resolved.isWaitingForOperator && resolved.waitingMessage) {
      console.log('[Engine] Returning waiting message');
      return {
        message: resolved.waitingMessage,
        isComplete: false,
        context: undefined,
      };
    }
    
    // Set flow config on engine (already resolved)
    engine.setFlowConfig(resolved.flowConfig);
    
    // Step 4: Process message with engine
    let result;
    
    if (resolved.shouldContinue && resolved.conversation.engineData) {
      // Continue existing conversation
      console.log('[Engine] Continuing conversation for:', phoneNumber);
      result = await engine.process(phoneNumber, normalizedInput, undefined);
    } else {
      // Start new conversation
      console.log('[Engine] Starting NEW conversation for:', phoneNumber);
      result = await engine.start(phoneNumber, undefined);
      
      // Apply customer data if this is a customer flow
      if (result.context && Object.keys(customerData).length > 0) {
        for (const [key, value] of Object.entries(customerData)) {
          result.context.set(key, value);
        }
        console.log('[Engine] Applied customer data to new context');
      }
    }

    // Update last activity timestamp and save
    if (result.context) {
      // Apply customer data to existing context if not already applied
      if (Object.keys(customerData).length > 0 && !result.context.get('isCustomer')) {
        for (const [key, value] of Object.entries(customerData)) {
          result.context.set(key, value);
        }
        console.log('[Engine] Applied customer data to existing context');
      }
      
      // Check if user provided a new address in address_confirm state and update client
      const currentAddress = result.context.get<string>('address');
      const originalAddress = result.context.get<string>('originalAddress');
      const clientId = result.context.get<string>('clientId');
      const tenantId = result.context.get<string>('tenantId');
      const locality = result.context.get<string>('locality');
      const province = result.context.get<string>('province');
      
      if (
        clientId &&
        tenantId &&
        currentAddress &&
        originalAddress &&
        currentAddress !== originalAddress
      ) {
        // Address was changed - update the client record
        console.log('[Engine] Updating client address:', { clientId, address: currentAddress, locality, province });
        await result.context.updateClientAddress(clientId, tenantId, currentAddress, locality, province);
        // Clear original so we don't update again
        result.context.set('originalAddress', currentAddress);
      }
      
      result.context.set('lastActivity', now.toISOString());
      await conversationStore.save(phoneNumber, result.context);
      console.log('[Engine] Saved context, new state:', result.context.get('currentState'));
      
      // Create service history record if this is a customer handoff
      const isCustomer = result.context.get<boolean>('isCustomer');
      const isComplete = result.context.get<boolean>('complete');
      
      if (result.handoff && isCustomer && isComplete && clientId && tenantId) {
        const serviceType = result.context.get<string>('serviceType');
        const description = result.context.get<string>('description');
        
        if (serviceType) {
          console.log('[Engine] Creating service history record:', { clientId, serviceType, address: currentAddress });
          try {
            await ClientServiceHistoryModel.create({
              tenantId: new Types.ObjectId(tenantId),
              clientId: new Types.ObjectId(clientId),
              serviceType: serviceType as 'repair' | 'maintenance' | 'installation' | 'budget' | 'other',
              address: currentAddress || '',
              locality: locality || '',
              province: province || '',
              description,
              status: 'pending',
              createdBy: 'whatsapp-bot',
            });
            console.log('[Engine] Service history record created successfully');
          } catch (error) {
            console.error('[Engine] Error creating service history record:', error);
          }
        }
      }
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