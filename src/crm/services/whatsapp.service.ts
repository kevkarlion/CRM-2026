import { Types } from 'mongoose';
import WhatsAppMessageModel from '../models/whatsapp-message';
import LeadModel from '../../leads/models/lead';
import ClientModel from '../models/client';
import ContactModel from '../models/contact';
import TenantModel from '../../core/models/tenant';
import { ClientServiceHistoryModel } from '@/clients';
import connectDB from '@/core/db';
import type { 
  IWhatsAppMessage, 
  CreateWhatsAppMessageInput,
  WhatsAppMessageDirection,
  WhatsAppMessageType 
} from '../types/whatsapp-message';
import type { ILead, InquiryReason, CustomerType } from '../../leads/types/lead';
import { calculateLeadScore } from '@/leads/services/lead-score.service';

// Conversation Engine imports
import {
  ConversationEngine,
  ConversationContext,
  TransitionPolicy,
  StateRegistry,
  EngineReplyComposer,
  getDefaultFlow,
  ConversationStore,
  conversationResolver,
  LEAD_QUALIFICATION_FLOW,
  CUSTOMER_SERVICE_FLOW,
  type FlowConfig,
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
      
      // Find ACTIVE conversation (either LEAD or CLIENT)
      const doc = await ConversationModel.findOne({ 
        phoneNumber,
        lifecycleState: { $in: ['ACTIVE_LEAD', 'ACTIVE_CLIENT'] },
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
       
      // Find existing ACTIVE conversation for this phone (either LEAD or CLIENT)
      const existing = await ConversationModel.findOne({
        phoneNumber,
        lifecycleState: { $in: ['ACTIVE_LEAD', 'ACTIVE_CLIENT'] },
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
        { phoneNumber, lifecycleState: { $in: ['ACTIVE_LEAD', 'ACTIVE_CLIENT'] } },
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
        { phoneNumber, lifecycleState: { $in: ['ACTIVE_LEAD', 'ACTIVE_CLIENT', 'WAITING_OPERATOR', 'WAITING_CLIENT'] } },
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
 * @param flowConfig - Optional flow configuration (defaults to lead qualification flow)
 */
function createConversationEngine(flowConfig?: FlowConfig): ConversationEngine {
  const defaultFlowConfig = flowConfig || getDefaultFlow();
  const stateRegistry = new StateRegistry();
  const transitionPolicy = new TransitionPolicy();
  const replyComposer = new EngineReplyComposer();

  const engine = new ConversationEngine({
    flowConfig: defaultFlowConfig,
    stateRegistry,
    transitionPolicy,
    replyComposer,
  });

  // Set the persistence store
  engine.setStore(conversationStore);

  return engine;
}

// Lazy-initialized engine instances - SEPARATED for Lead and Client
let leadConversationEngine: ConversationEngine | null = null;
let clientConversationEngine: ConversationEngine | null = null;

function getLeadConversationEngine(): ConversationEngine {
  if (!leadConversationEngine) {
    leadConversationEngine = createConversationEngine(LEAD_QUALIFICATION_FLOW);
  }
  return leadConversationEngine;
}

function getClientConversationEngine(): ConversationEngine {
  if (!clientConversationEngine) {
    clientConversationEngine = createConversationEngine(CUSTOMER_SERVICE_FLOW);
  }
  return clientConversationEngine;
}

// Legacy function - deprecated, use getLeadConversationEngine or getClientConversationEngine
function getConversationEngine(): ConversationEngine {
  return getLeadConversationEngine();
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
    
    let waMessageId: string;
    let messageStatus: 'sent' | 'failed' = 'sent';
    let errorMessage: string | undefined;
    
    if (!response.ok) {
      console.error('[WhatsApp] Error enviando mensaje:', metaResponse);
      messageStatus = 'failed';
      errorMessage = metaResponse.error?.message || 'Error enviando mensaje';
      waMessageId = `failed_${Date.now()}`;
    } else {
      waMessageId = metaResponse.messages?.[0]?.id || '';
    }

    // Always save message, even if WhatsApp API failed
    const message = await this.saveMessage({
      tenantId: new Types.ObjectId(tenantId),
      phone: normalizedTo,
      messageId: waMessageId,
      direction: 'outbound',
      type: 'text',
      content: text,
      status: messageStatus,
      errorMessage,
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
    messageContent?: string,
    profileName?: string
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

    // Crear nuevo lead - usar profileName si está disponible, sino fallback a "Lead WhatsApp XXXX"
    const leadName = profileName || `Lead WhatsApp ${normalizedPhone.slice(-4)}`;
    const newLead = new LeadModel({
      tenantId: new Types.ObjectId(tenantId),
      name: leadName,
      companyName: profileName || undefined, // Guardar profileName como empresa si existe
      phone: normalizedPhone,
      source: 'whatsapp',
      status: 'new',
      notes: messageContent ? `Mensaje inicial: ${messageContent}` : 'Creado desde WhatsApp',
      createdBy: 'whatsapp-bot',
      updatedBy: 'whatsapp-bot',
      profileName: profileName || undefined, // Guardar profileName explícitamente
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
    profileName?: string,
    mediaMetadata?: {
      mediaId: string;
      caption?: string;
      filename?: string;
      mimeType?: string;
    }
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
      metadata: mediaMetadata ? {
        pendingDownload: true,  // Flag para indicar que requiere acción del usuario
        mediaId: mediaMetadata.mediaId,
        caption: mediaMetadata.caption || '',
        filename: mediaMetadata.filename || '',
        mimeType: mediaMetadata.mimeType || 'application/octet-stream',
      } : undefined,
    });

    // 2. Buscar o crear lead
    const { lead, isNew } = await this.findOrCreateLeadByPhone(tenantId, phone, content, profileName);
    
    // DEBUG: Log lead status
    console.log('[WhatsApp] Lead status:', lead?.status, '| isNew:', isNew, '| phone:', normalizedPhone);

    // 3. Actualizar lead si es nuevo o si hay información relevante
    if (lead) {
      // Actualizar el mensaje con el leadId
      message.leadId = lead._id;
      await message.save();

      // Si es nuevo lead, already tiene el notes con el mensaje inicial
      // Si ya existía, agregamos el mensaje a los notes
      if (!isNew && content) {
        console.log('[WhatsApp] Lead exists, updating notes. Priority before:', lead.priority);
        
        const currentNotes = lead.notes || '';
        lead.notes = `${currentNotes}\n${new Date().toISOString()}: ${content}`.trim();
        
        // Clear invalid priority to avoid validation errors
        // (old leads may have priority labels like "Lo antes posible" instead of enum values)
        const leadPriority = lead.priority;
        const priorityStr = String(leadPriority || '').trim().toLowerCase();
        const validPriorities = ['high', 'medium', 'low'];
        
        console.log('[WhatsApp] Current lead priority:', leadPriority, '| Valid?', validPriorities.includes(priorityStr));
        
        if (leadPriority && !validPriorities.includes(priorityStr)) {
          console.log('[WhatsApp] Clearing invalid priority:', leadPriority);
          lead.priority = undefined;
        }
        
        console.log('[WhatsApp] Saving lead with priority:', lead.priority);
        await lead.save();
        console.log('[WhatsApp] Lead saved successfully');
      }
    }

    // 4. Generar respuesta automática - siempre usar Conversation Engine
    let shouldRespond = false;
    let responseText: string | undefined;

    console.log('[WhatsApp] Using Conversation Engine');
    
    try {
      console.log('🎯 [SCORING] Llamando a processWithEngine...');
      const engineResult = await this.processWithEngine(tenantId, normalizedPhone, content, isNew, profileName);
      console.log('[WhatsApp] Engine result:', { 
        message: engineResult.message?.substring(0, 50), 
        isComplete: engineResult.isComplete 
      });
      shouldRespond = true;
      responseText = engineResult.message;
      
      // Check if flow is complete (either now or previously)
      const isFlowComplete = engineResult.isComplete || 
                             engineResult.context?.data?.complete === true ||
                             engineResult.context?.data?.confirmed === true;
      
      // If flow is complete, update lead status to contacted
      // Note: The resolver now handles putting conversation in WAITING state when it detects isComplete
      if (isFlowComplete) {
        console.log('[WhatsApp] Flow complete, lead will be updated with captured data below');
        // The resolver handles putting the conversation in WAITING state when it detects isComplete in engineData
}
       
      // Update lead with captured data from conversation
      console.log('🎯 [SCORING] engineResult.context existe?', !!engineResult.context);
      if (engineResult.context) {
          const contextData = engineResult.context.data;
          
          const userName = contextData.userName as string | undefined;
          const customerName = contextData.customerName as string | undefined;
          const address = contextData.address as string | undefined;
          const locality = contextData.locality as string | undefined;
          const province = contextData.province as string | undefined;
          const priorityValue = contextData.priority as string | undefined;
          const priorityLabel = contextData.priorityLabel as string | undefined;
          const needType = contextData.serviceTypeLabel as string | undefined;
          const description = contextData.description as string | undefined;
          
          // Map priority values
          const priorityEnumMap: Record<string, string> = {
            'asap': 'high',
            'this_week': 'medium',
            'next_week': 'low',
            'urgent': 'high', // urgent = high priority
          };
          const priorityForLead = priorityValue ? priorityEnumMap[priorityValue] : undefined;
          const priorityDisplayLabel = priorityLabel || (priorityValue === 'asap' ? 'HOY' : priorityValue === 'this_week' ? 'Esta semana' : priorityValue === 'next_week' ? 'No tengo apuro' : priorityValue);
          
          console.log('🎯 [SCORING] Buscando lead para actualizar...');
          
          try {
            const leadToUpdate = await LeadModel.findOne({
              tenantId: new Types.ObjectId(tenantId),
              phone: { $regex: new RegExp(normalizedPhone.replace(/^\+/, ''), 'i') },
              deletedAt: null,
            });
            
            if (leadToUpdate) {
              const updateData: Record<string, any> = {};
              
              // Update name - use customerName (what lead typed in bot), fallback to profileName
              const nameFromBot = customerName || userName;
              if (nameFromBot) {
                updateData.name = nameFromBot;
                console.log('[WhatsApp] Updating name to (from bot):', nameFromBot);
              }
              
              // Update company - use profileName from WhatsApp
              if (profileName) {
                updateData.companyName = profileName;
                console.log('[WhatsApp] Updating company to (profileName):', profileName);
              }
              
              // Update status ONLY if flow is complete
              console.log('🎯 [SCORING] Verificando lead:', { 
                isFlowComplete, 
                currentStatus: leadToUpdate?.status,
                needType,
                priorityValue,
                priorityForLead 
              });
              
              if (isFlowComplete && leadToUpdate?.status === 'new') {
                updateData.status = 'contacted';
                updateData.updatedBy = 'whatsapp-bot';
                
                // Map service type label to inquiry reason enum
                const inquiryReasonMap: Record<string, InquiryReason> = {
                  'reparación': 'repair',
                  'repair': 'repair',
                  'instalación': 'installation',
                  'installation': 'installation',
                  'mantenimiento': 'maintenance',
                  'maintenance': 'maintenance',
                  'presupuesto': 'budget',
                  'budget': 'budget',
                };
                const inquiryReasonValue = needType ? inquiryReasonMap[needType.toLowerCase()] : undefined;
                
                // Guardar inquiryReason y priority en el lead
                if (inquiryReasonValue) {
                  updateData.inquiryReason = inquiryReasonValue;
                  console.log('🎯 [SCORING] inquiryReason guardada:', inquiryReasonValue);
                } else {
                  console.log('🎯 [SCORING] inquiryReason NO guardada - needType:', needType);
                }
                
                if (priorityForLead) {
                  updateData.priority = priorityForLead;
                  console.log('🎯 [SCORING] priority guardada:', priorityForLead);
                } else {
                  console.log('🎯 [SCORING] priority NO guardada - priorityValue:', priorityValue);
                }
                
                // Calculate score based on lead data (usando los mismos valores que guardamos)
                let calculatedScore = null;
                try {
                  calculatedScore = calculateLeadScore({
                    inquiryReason: inquiryReasonValue,
                    priority: priorityForLead as 'high' | 'medium' | 'low' | undefined,
                    customerType: (leadToUpdate?.customerType as CustomerType) || 'residential',
                    isB2B: leadToUpdate?.isB2B,
                  });
                  
                  console.log('🎯 [SCORING] Score calculado:', { 
                    score: calculatedScore.score, 
                    temperature: calculatedScore.temperature 
                  });
                  
                  updateData.score = calculatedScore.score;
                  updateData.temperature = calculatedScore.temperature;
                  updateData.scoringBreakdown = calculatedScore.breakdown;
                } catch (scoreError) {
                  console.error('🎯 [SCORING] Error calculating score:', scoreError);
                  // Continue without score - don't fail the whole update
                }
                
                console.log('🎯 [SCORING] Flow complete - Setting status to contacted');
              }
              
              // Update priority
              if (priorityForLead) {
                updateData.priority = priorityForLead;
              }
              
              // Update address fields
              if (address) updateData.address = address;
              if (locality) updateData.locality = locality;
              if (province) updateData.province = province;
              
              // Save bot summary as notes
              const notesParts: string[] = [];
              if (needType) notesParts.push(`Servicio: ${needType}`);
              if (priorityDisplayLabel) notesParts.push(`Necesidad: ${priorityDisplayLabel}`);
              if (description) notesParts.push(`Descripción: ${description}`);
              
              if (notesParts.length > 0) {
                updateData.notes = notesParts.join(' | ');
                console.log('[WhatsApp] Updating notes with:', updateData.notes);
              }
              
              if (Object.keys(updateData).length > 0) {
                console.log('🎯 [SCORING] Guardando updateData:', JSON.stringify(updateData));
                await LeadModel.findByIdAndUpdate(leadToUpdate._id, { $set: updateData });
                console.log('[WhatsApp] ✅ Lead updated with all data');
              }
            }
          } catch (error) {
            console.error('[WhatsApp] Error updating lead data:', error);
          }
        }
      
      if (engineResult.handoff) {
        console.log('[WhatsApp] Handoff to human triggered');
      }
    } catch (error) {
      console.error('[WhatsApp] Engine error:', error);
      // Fall back to simple error message
      shouldRespond = true;
      responseText = 'Estamos procesando tu solicitud. En breve un asesor seará en contacto contigo. 😊';
      // Log more details
      if (error instanceof Error) {
        console.error('[WhatsApp] Error stack:', error.stack);
      }
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
   * Process message using the new Conversation Engine + ConversationResolver
   * 
   * Flow:
   * 1. Use ConversationResolver to get the right conversation (ACTIVE, WAITING_OPERATOR, or new)
   * 2. If customer flow, initialize context with customer data
   * 3. Process message with engine (continue or start new)
   * 4. Save context and return response
   */
  private async processWithEngine(
    tenantId: string,
    phoneNumber: string,
    input: string,
    isNewLead: boolean,
    profileName?: string
  ): Promise<{ message: string; isComplete: boolean; handoff?: boolean; context?: ConversationContext; flowId?: string }> {
    console.log('[Engine] === START === phone:', phoneNumber, '| input:', input);
    
    // Ensure DB is connected
    await connectDB();
    
    const normalizedInput = input.trim();
    const normalizedPhone = phoneNumber.replace(/[\s\-\(\)\+]/g, '').replace(/^0/, '');
    
    // Get or create lead ID for this phone
    const lead = await LeadModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      phone: { $regex: new RegExp(normalizedPhone.replace(/^\+/, ''), 'i') },
      deletedAt: null,
    });
    
    const leadId = lead?._id?.toString() || '';
    
    // Step 1: Use ConversationResolver to get the right conversation
    console.log('[Engine] Resolving conversation...');
    const resolved = await conversationResolver.resolveConversation(
      normalizedPhone,
      tenantId,
      leadId,
      profileName
    );
    
    // ===== VERIFICAR SI OPERADOR TIENE CONTROL =====
    // Si skipBot es true, el operador tiene control → NO procesar con bot
    if (resolved.skipBot) {
      console.log('[Engine] ⏭️ OPERATOR HAS CONTROL - Bot NOT responding');
      return {
        message: '', // No message - bot doesn't respond
        isComplete: true, // Mark as complete to skip processing
        skipBot: true,
        conversation: resolved.conversation,
      };
    }
    
    // Save flowId for determining waiting state later
    const flowId = resolved.flowConfig.id;
    console.log('[Engine] Flow ID:', flowId);
    
    console.log('[Engine] Resolved:', {
      shouldContinue: resolved.shouldContinue,
      isWaitingForOperator: resolved.isWaitingForOperator,
      isNew: resolved.isNew,
      lifecycleState: resolved.conversation.lifecycleState,
    });
    
    // If waiting for operator, return the waiting message
    if (resolved.isWaitingForOperator && resolved.waitingMessage) {
      console.log('[Engine] ✅ Returning waiting message (lead already contacted):', resolved.waitingMessage.substring(0, 50));
      
      // Save profileName if available (even for contacted leads)
      if (resolved.profileName) {
        try {
          const existingLead = await LeadModel.findOne({
            tenantId: new Types.ObjectId(tenantId),
            phone: { $regex: new RegExp(normalizedPhone.replace(/^\+/, ''), 'i') },
            deletedAt: null,
          });
          
          if (existingLead && !existingLead.profileName) {
            await LeadModel.findByIdAndUpdate(existingLead._id, {
              $set: { profileName: resolved.profileName }
            });
            console.log('[Engine] Saved profileName:', resolved.profileName);
          }
        } catch (error) {
          console.error('[Engine] Error saving profileName:', error);
        }
      }
      
      return {
        message: resolved.waitingMessage,
        isComplete: false,
        context: undefined,
      };
    }
    
    // Get the conversation engine - SEPARATED for Lead and Client
    const isClientFlow = resolved.flowConfig.id === 'customer-service';
    const engine = isClientFlow ? getClientConversationEngine() : getLeadConversationEngine();
    console.log('[Engine] Using', isClientFlow ? 'CLIENT' : 'LEAD', 'engine. Flow:', resolved.flowConfig.id);
    
    // Step 2: If customer flow, initialize context with customer data
    let customerData: Record<string, unknown> = {};
    if (resolved.flowConfig.id === 'customer-service') {
      console.log('[Engine] Loading customer data for personalized greeting...');
      try {
        // FIRST: Try to find via ContactModel (phone is stored in contacts, not clients)
        const normalizedPhoneSearch = normalizedPhone.replace(/^\+/, '');
        const contactWithPhone = await ContactModel.findOne({
          tenantId: new Types.ObjectId(tenantId),
          phone: { $regex: new RegExp(normalizedPhoneSearch, 'i') },
          deletedAt: null,
        }).populate('clientId').lean();
        
        if (contactWithPhone && contactWithPhone.clientId) {
          const client = contactWithPhone.clientId as any;
          console.log('[Engine] ✅ Customer found via ContactModel:', client.fullName || client.name);
          const tempContext = new ConversationContext(phoneNumber);
          tempContext.initializeFromCustomer(client);
          
          customerData = {
            customerName: tempContext.get('customerName'),
            address: tempContext.get('address'),
            locality: tempContext.get('locality'),
            province: tempContext.get('province'),
            isCustomer: true,
            clientId: tempContext.get('clientId'),
            tenantId: tenantId,
            originalAddress: tempContext.get('address'),
            originalLocality: tempContext.get('locality'),
            originalProvince: tempContext.get('province'),
          };
          
          console.log('[Engine] Customer data ready:', customerData);
        } else {
          // SECOND: Try to find via LeadModel (lead was won/qualified - use lead data)
          console.log('[Engine] Looking for lead with status won/qualified, phone:', normalizedPhoneSearch);
          const lead = await LeadModel.findOne({
            tenantId: new Types.ObjectId(tenantId),
            phone: { $regex: new RegExp(normalizedPhoneSearch, 'i') },
            status: { $in: ['won', 'qualified'] },
            deletedAt: null,
          }).lean();
          
          if (lead) {
            console.log('[Engine] ✅ Customer found via LeadModel (won/qualified):', lead.name);
            const tempContext = new ConversationContext(phoneNumber);
            // Initialize from lead data (has name, address, etc.)
            tempContext.initializeFromCustomer({
              fullName: lead.name,
              address: lead.address,
              locality: lead.locality,
              province: lead.province,
              _id: lead._id,
              tenantId: lead.tenantId,
            } as any);
            
            customerData = {
              customerName: tempContext.get('customerName'),
              address: tempContext.get('address'),
              locality: tempContext.get('locality'),
              province: tempContext.get('province'),
              isCustomer: true,
              clientId: tempContext.get('clientId'),
              tenantId: tenantId,
              originalAddress: tempContext.get('address'),
              originalLocality: tempContext.get('locality'),
              originalProvince: tempContext.get('province'),
            };
            
            console.log('[Engine] Customer data ready from lead:', customerData);
          } else {
            console.log('[Engine] ❌ No customer/lead data found for phone:', normalizedPhoneSearch);
          }
        }
      } catch (error) {
        console.error('[Engine] Error loading customer:', error);
      }
    }
    
    // Step 3: Process message with engine
    let result;
    
    if (resolved.shouldContinue && resolved.conversation.engineData) {
      // Continue existing conversation
      console.log('[Engine] Continuing conversation for:', phoneNumber);
      result = await engine.process(phoneNumber, normalizedInput, undefined);
    } else {
      // Start new conversation - pass customer data if available for customer flow
      console.log('[Engine] Starting NEW conversation for:', phoneNumber);
      result = await engine.start(phoneNumber, undefined, customerData);
      
      // Log applied customer data for debugging
      if (result.context) {
        console.log('[Engine] Context after start - customerName:', result.context.get('customerName'));
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
      
      result.context.set('lastActivity', new Date().toISOString());
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
      flowId, // Add flowId to determine client vs lead
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

    // Check if message contains a footer (like supplier phone message)
    // Footer is typically at the end and contains "comunícate" or "proveedor"
    const footerPattern = /¿Eres proveedor\?|comunícate|proveedor/i;
    const hasFooter = footerPattern.test(message);

    // Build options text
    const optionsText = options
      .map((opt, idx) => {
        const trimmed = opt.trim();
        // Check if already has a prefix (number + emoji OR number + dot/parenthesis)
        // Patterns: "1️⃣", "2️⃣" (keycap) OR "1.", "2.", "1)", "2)"
        const hasPrefix = /^\d+[\s\S]/.test(trimmed);
        
        if (hasPrefix) {
          return opt;
        }
        return `${idx + 1}. ${opt}`;
      })
      .join('\n');

    // If there's a footer, put options BEFORE the footer
    if (hasFooter) {
      const parts = message.split(footerPattern);
      if (parts.length >= 2) {
        // message before footer + options + footer
        return `${parts[0].trim()}\n\n${optionsText}\n\n${parts.slice(1).join('').trim()}`;
      }
    }

    // Default: message + options at the end
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

  /**
   * Busca un mensaje por su ID
   */
  async findMessageById(messageId: string): Promise<IWhatsAppMessage | null> {
    return WhatsAppMessageModel.findOne({ messageId }).lean();
  }

  /**
   * Actualiza los metadatos de un mensaje
   */
  async updateMessageMetadata(
    messageId: string,
    metadata: Record<string, any>
  ): Promise<IWhatsAppMessage | null> {
    return WhatsAppMessageModel.findOneAndUpdate(
      { messageId },
      { $set: { metadata } },
      { new: true }
    ).lean();
  }
}

export default new WhatsAppService();