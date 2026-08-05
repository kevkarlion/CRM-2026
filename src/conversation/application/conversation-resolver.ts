import { Types } from 'mongoose';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import LeadModel from '@/leads/models/lead';
import ContactModel from '@/crm/models/contact';
import { LEAD_QUALIFICATION_FLOW, CUSTOMER_SERVICE_FLOW } from '@/conversation/config';
import type { ConversationLifecycleState, ConversationOwner, ConversationLifecycleEvent } from '@/conversation/domain/conversation';
import { CONVERSATION_REUSE_WINDOW_MS } from '@/conversation/domain/conversation';

const CONVERSATION_TIMEOUT_MINUTES = 30;

// Simple message for contacted leads
const WAITING_FOR_OPERATOR_MESSAGE = '👋 Gracias por tu mensaje.\n\nTu solicitud ya fue registrada correctamente.\n\nUn asesor continuará la conversación lo antes posible.';

/**
 * Events that can occur during WAITING_OPERATOR state
 */
export type WaitingOperatorEvent = 
  | 'CUSTOMER_FOLLOW_UP'      // Client sent another message while waiting
  | 'CUSTOMER_SENT_REMINDER'  // Client is explicitly asking for attention
  | 'CUSTOMER_REPLIED_WAITING'; // Generic reply while waiting

/**
 * Priority levels for conversations waiting for operator
 */
export enum WaitingPriority {
  NORMAL = 'normal',
  MEDIUM = 'medium', 
  HIGH = 'high',
}

/**
 * Result of resolving a conversation for an incoming message
 */
export interface ResolvedConversation {
  /** The conversation to use */
  conversation: {
    id: string;
    phoneNumber: string;
    leadId: string;
    lifecycleState: ConversationLifecycleState;
    engineData?: Record<string, unknown>;
    waitingMessageCount?: number;
    waitingPriority?: WaitingPriority;
  };
  /** Whether to continue the existing conversation or start fresh */
  shouldContinue: boolean;
  /** Whether the conversation is waiting for operator */
  isWaitingForOperator: boolean;
  /** Whether a new conversation was created */
  isNew: boolean;
  /** Message to send back if waiting for operator */
  waitingMessage?: string;
  /** Event that occurred (if any) */
  waitingEvent?: WaitingOperatorEvent;
  /** Flow configuration to use */
  flowConfig: {
    id: string;
    initialState: string;
  };
  /** Profile name from WhatsApp (if available) */
  profileName?: string;
  /** Skip bot processing - operator has control */
  skipBot?: boolean;
}

/**
 * ConversationResolver - responsible for deciding which conversation to use for incoming messages
 * 
 * Responsibilities:
 * - Search for existing conversations
 * - Check expiration (only for ACTIVE state)
 * - Close expired conversations
 * - Create new conversations when needed
 * - Handle WAITING_OPERATOR state without timeout
 * - Return the correct conversation
 */
export class ConversationResolver {
/**
   * Resolve conversation - determine if new or continuation
   * 
   * FLUJO SIMPLE:
   * 1. Detectar si es CLIENTE (ContactModel o Lead.isClient=true)
   * 2. Si hay conversación activa, CONTINUAR desde donde quedó
   * 3. Si no, CREAR NUEVA
   */
  async resolveConversation(
    phoneNumber: string,
    tenantId: string,
    leadId?: string,
    profileName?: string,
  ): Promise<ResolvedConversation> {
    await connectDB();
    
    const normalizedPhone = phoneNumber.replace(/[\s\-\(\)\+]/g, '').replace(/^0/, '');
    
// ===== STEP 1: DETECTAR TIPO (CLIENTE O LEAD) =====
    // Cliente = ContactModel (prioridad) O Lead con status "won"
    
    const contact = await ContactModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      phone: { $regex: new RegExp(normalizedPhone.replace(/^\+/, ''), 'i') },
      deletedAt: null,
    }).populate('clientId');
    
    // Primero verificar en ContactModel
    let isClient = !!(contact && contact.clientId);
    
    // Si no está en ContactModel, buscar en Lead con status "won"
    if (!isClient) {
      const lead = await LeadModel.findOne({
        tenantId: new Types.ObjectId(tenantId),
        phone: { $regex: new RegExp(normalizedPhone.replace(/^\+/, ''), 'i') },
        status: 'won',
        deletedAt: null,
      }).lean();
      
      isClient = !!lead;
    }
    
    console.log('[Resolver] isClient:', isClient);
    
    // Si es cliente, cerrar cualquier conversación de lead existente
    // Esto asegura que un lead convertido a cliente inicie fresh con flow de cliente
    if (isClient) {
      console.log('[Resolver] Client detected - closing any existing lead conversations');
      await this.closeLeadConversations(normalizedPhone);
    }
    
    // Seleccionar flow según tipo
    const flowConfig = isClient ? CUSTOMER_SERVICE_FLOW : LEAD_QUALIFICATION_FLOW;
    const flowTypeFilter = isClient ? 'customer-service' : 'lead-qualification';
    
    console.log('[Resolver] ════════════════════════');
    console.log('[Resolver] Phone:', normalizedPhone);
    console.log('[Resolver] Type:', isClient ? 'CLIENTE' : 'LEAD');
    
    // ===== VERIFICAR SI OPERADOR TIENE CONTROL O FLOW ESTÁ COMPLETO =====
    // PRIORIDAD: Si el operador tiene control (IN_PROGRESS), el bot NO responde
    // NOTA: No filtramos por flowType porque conversaciones antiguas pueden no tenerlo
    const operatorControl = await ConversationModel.findOne({
      phoneNumber: normalizedPhone,
      owner: 'OPERATOR',
      lifecycleState: { $in: ['IN_PROGRESS', 'RESOLVED'] },
    }).sort({ lastActivityAt: -1 }).lean();

    if (operatorControl) {
      console.log('[Resolver] ⚠️ Operator control detected:', operatorControl._id, 'state:', operatorControl.lifecycleState, 'flowType:', operatorControl.flowType, 'isComplete:', operatorControl.isComplete);
      
      if (operatorControl.lifecycleState === 'IN_PROGRESS') {
        // Operador tiene control activo → NO procesar con bot, devolver special result
        console.log('[Resolver] → OPERATOR HAS CONTROL (IN_PROGRESS) - Bot should NOT respond');
        return {
          skipBot: true,
          conversation: operatorControl,
          flowConfig,
          isNew: false,
        };
      }
      
      // RESOLVED → verificar ventana 72h para reuse
      // Only match flowType if it exists to avoid matching old conversations without this field
      if (operatorControl.flowType && operatorControl.flowType !== flowTypeFilter) {
        // Different flowType - treat as if no resolved conversation exists
        console.log('[Resolver] RESOLVED has different flowType, will create new conversation');
      } else {
        // Same flowType or no flowType - check 72h window
        console.log('[Resolver] State is RESOLVED - checking 72h window...');
      }
    }
    
    // ===== VERIFICAR SI HAY CONVERSACIÓN COMPLETA SIN OPERADOR =====
    // Si el flow está completo (isComplete = true) pero no hay operador, verificar si necesitamos crear nueva
    const completeConversation = await ConversationModel.findOne({
      phoneNumber: normalizedPhone,
      isComplete: true,
      owner: 'BOT',
      lifecycleState: { $in: ['ACTIVE_LEAD', 'ACTIVE_CLIENT', 'WAITING_OPERATOR', 'WAITING_CLIENT'] },
    }).sort({ lastActivityAt: -1 }).lean();
    
    if (completeConversation) {
      console.log('[Resolver] Found complete conversation:', completeConversation._id, 'state:', completeConversation.lifecycleState, 'isComplete:', completeConversation.isComplete);
      // There's a complete conversation - this is normal, continue with normal flow
    }
    
    // ===== LÓGICA DE RESOLUCIÓN =====
    // Estados separados para lead y cliente:
    // - Lead: ACTIVE_LEAD / WAITING_OPERATOR
    // - Cliente: ACTIVE_CLIENT / WAITING_CLIENT
    
    const activeState = isClient ? 'ACTIVE_CLIENT' : 'ACTIVE_LEAD';
    const waitingState = isClient ? 'WAITING_CLIENT' : 'WAITING_OPERATOR';
    
    // Paso 1: Buscar conversación ACTIVA según tipo
    console.log(`[Resolver] Looking for ${activeState} conversation for:`, normalizedPhone);
    const existingActive = await this.findConversationByState(normalizedPhone, activeState);
    console.log(`[Resolver] Found ${activeState}:`, existingActive ? existingActive._id : 'NONE');
    
    if (existingActive) {
      // Hay conversación activa → CONTINUAR desde donde quedó
      console.log(`[Resolver] → CONTINUE (${isClient ? 'CLIENTE' : 'LEAD'} con conversación activa)`);
      return this.continueConversation(existingActive, normalizedPhone, tenantId, leadId || '', flowConfig);
    }
    
    // Paso 2: Buscar conversación de espera (ya fue atendido anteriormente)
    console.log(`[Resolver] Looking for ${waitingState} conversation for:`, normalizedPhone);
    const existingWaiting = await this.findConversationByState(normalizedPhone, waitingState);
    console.log(`[Resolver] Found ${waitingState}:`, existingWaiting ? existingWaiting._id : 'NONE');
    
    if (existingWaiting) {
      // Ya fue atendido anteriormente → devolver mensaje de "procesando"
      const engineData = existingWaiting.engineData as Record<string, unknown> | undefined;
      const customerName = engineData?.customerName as string | undefined;
      
      console.log(`[Resolver] → ${isClient ? 'CLIENTE' : 'LEAD'} YA ATENDIDO: waiting message`);
      return this.handleWaitingState(
        existingWaiting,
        normalizedPhone,
        tenantId,
        leadId || '',
        flowConfig,
        waitingState,
        customerName
      );
    }
    
    // Buscar conversación RESOLVED dentro de ventana de reutilización (72h)
    // Filtrar por flowType para no mezclar conversaciones de lead y cliente
    console.log('[Resolver] Looking for RESOLVED conversation for:', normalizedPhone);
    
    const existingResolved = await ConversationModel.findOne({
      phoneNumber: normalizedPhone,
      lifecycleState: 'RESOLVED',
      flowType: flowTypeFilter, // Only match same type (lead or client)
      resolvedAt: { $exists: true, $ne: null },
    }).sort({ resolvedAt: -1 }).lean();
    
    if (existingResolved) {
      console.log(`[Resolver] Found RESOLVED conversation:`, existingResolved._id, 'flowType:', existingResolved.flowType);
      
      if (this.isWithinReuseWindow(existingResolved)) {
        // Dentro de 72h → reutilizar conversación
        console.log('[Resolver] ✅ Within 72h reuse window - reusing conversation');
        return this.handleReuseWindow(
          existingResolved,
          normalizedPhone,
          tenantId,
          leadId || '',
          flowConfig,
          waitingState
        );
      } else {
        // Más de 72h → crear nueva conversación
        console.log('[Resolver] ⏰ Outside 72h reuse window - creating new conversation');
      }
    } else {
      console.log(`[Resolver] No RESOLVED conversation found with flowType: ${flowTypeFilter}`);
    }
    
    // Paso 3: No hay conversación → crear nueva
    console.log(`[Resolver] → CREATE NEW (${isClient ? 'CLIENTE' : 'LEAD'})`);
    return this.createNewConversation(normalizedPhone, tenantId, leadId, flowConfig, activeState);
  }

  /**
   * Find lead by phone number
   */
  private async findLeadByPhone(phoneNumber: string, tenantId: string): Promise<any | null> {
    // Normalize phone number the same way as in whatsapp.service
    const normalizedForSearch = phoneNumber.replace(/[\s\-\(\)\+]/g, '').replace(/^0/, '');
    
    const lead = await LeadModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      phone: { $regex: new RegExp(normalizedForSearch.replace(/^\+/, ''), 'i') },
      deletedAt: null,
    }).lean();
    return lead;
  }

  /**
   * Check if lead status indicates it's already been contacted/qualified
   * 
   * These statuses mean the lead is waiting for human response (not a customer yet)
   * NOTE: 'won' and 'qualified' leads are treated as customers - they should NOT get waiting message
   */
  private isLeadAlreadyContacted(status: string): boolean {
    const contactedStatuses = [
      'contacted',
      'quote_sent',
      'technical_visit',
      'negotiation',
      // NOT including 'qualified' and 'won' - those are customers
    ];
    return contactedStatuses.includes(status);
  }

  /**
   * Handle a conversation in WAITING state (either lead or client)
   * 
   * Key principles:
   * - NEVER restart the flow while waiting for operator
   * - Return a waiting message (different for lead vs client)
   * - Register event for audit
   * - Increment priority based on message count
   */
  private async handleWaitingState(
    conversation: any,
    normalizedPhone: string,
    tenantId: string,
    leadId: string,
    flowConfig: { id: string; initialState: string },
    waitingState: 'WAITING_OPERATOR' | 'WAITING_CLIENT',
    customerName?: string
  ): Promise<ResolvedConversation> {
    // Get current message count (for priority calculation)
    const messageCount = (conversation.waitingMessageCount || 0) + 1;
    
    // Determine priority based on message count
    const priority = this.calculatePriority(messageCount);
    
    // Determine event type
    const waitingEvent = this.determineWaitingEvent(messageCount);
    
    // Update conversation with new message count and priority
    await ConversationModel.findByIdAndUpdate(conversation._id, {
      $set: {
        waitingMessageCount: messageCount,
        waitingPriority: priority,
        lastActivityAt: new Date(),
        lastMessageAt: new Date(),
        updatedAt: new Date(),
        lifecycleState: waitingState,
      },
      $push: {
        waitingEvents: {
          event: waitingEvent,
          timestamp: new Date(),
          priority: priority,
        },
      },
    });
    
    // Get appropriate message based on waiting state type
    const waitingMessage = waitingState === 'WAITING_CLIENT' 
      ? this.getClientWaitingMessage(priority, customerName)
      : this.getWaitingMessage(priority);
    
    console.log(`[Resolver] ${waitingState} - Event: ${waitingEvent}, Priority: ${priority}, Count: ${messageCount}`);
    
    return {
      conversation: {
        id: conversation._id.toString(),
        phoneNumber: normalizedPhone,
        leadId: conversation.leadId?.toString() || leadId,
        lifecycleState: waitingState,
        engineData: conversation.engineData as Record<string, unknown> | undefined,
        waitingMessageCount: messageCount,
        waitingPriority: priority,
      },
      shouldContinue: false,
      isWaitingForOperator: true,
      isNew: false,
      waitingEvent,
      waitingMessage,
      flowConfig,
      profileName: conversation.profileName,
    };
  }

  /**
   * Get waiting message for leads
   */
  private getWaitingMessage(priority: WaitingPriority): string {
    const baseMessage = `👋 Gracias por tu mensaje.

Tu solicitud ya fue registrada correctamente.

Un asesor continuará la conversación lo antes posible.`;

    if (priority === WaitingPriority.HIGH) {
      return `⚠️ ${baseMessage}

📩 Tu mensaje ha sido marcado como prioritario.`;
    }

    return baseMessage;
  }

  /**
   * Get waiting message for clients (more personalized)
   */
  private getClientWaitingMessage(priority: WaitingPriority, customerName?: string): string {
    const name = customerName || 'cliente';
    const baseMessage = `✨ Gracias por contactarnos, ${name}.

Un asesor de Rolo Climatizaciones te atenderá personalmente.

¡Te respondemos en breve! 😊`;

    if (priority === WaitingPriority.HIGH) {
      return `⚠️ ${baseMessage}

📩 Tu mensaje ha sido marcado como prioritario.`;
    }

    return baseMessage;
  }

  /**
   * Continue an existing ACTIVE conversation
   * 
   * Key principles:
   * - Return the existing conversation with its engineData
   * - Set shouldContinue: true so engine processes the input
   * - Preserve all captured data from previous messages
   */
  private continueConversation(
    conversation: any,
    normalizedPhone: string,
    tenantId: string,
    leadId: string,
    flowConfig: { id: string; initialState: string }
  ): ResolvedConversation {
    const engineData = conversation.engineData as Record<string, unknown> | undefined;
    const currentState = engineData?.currentState as string | undefined;
    
    console.log(`[Resolver] Continuing conversation - State: ${currentState}, LeadId: ${conversation.leadId}`);
    
    return {
      conversation: {
        id: conversation._id.toString(),
        phoneNumber: normalizedPhone,
        leadId: conversation.leadId?.toString() || leadId,
        lifecycleState: 'ACTIVE',
        engineData,
      },
      shouldContinue: true,
      isWaitingForOperator: false,
      isNew: false,
      flowConfig,
    };
  }

  /**
   * Calculate priority based on message count
   * 
   * Architecture prepared for future algorithm refinement
   */
  private calculatePriority(messageCount: number): WaitingPriority {
    if (messageCount >= 3) {
      return WaitingPriority.HIGH;
    } else if (messageCount >= 2) {
      return WaitingPriority.MEDIUM;
    }
    return WaitingPriority.NORMAL;
  }

  /**
   * Determine event type based on message count
   */
  private determineWaitingEvent(messageCount: number): WaitingOperatorEvent {
    if (messageCount === 1) {
      return 'CUSTOMER_FOLLOW_UP';
    }
    // For messageCount >= 2, could be more specific in future
    return 'CUSTOMER_SENT_REMINDER';
  }

  /**
   * Get waiting message based on priority
   */
  private getWaitingMessage(priority: WaitingPriority): string {
    const baseMessage = `👋 Gracias por tu mensaje.

Tu solicitud ya fue registrada correctamente.

Un asesor continuará la conversación lo antes posible.`;

    if (priority === WaitingPriority.HIGH) {
      return `⚠️ ${baseMessage}

📩 Tu mensaje ha sido marcado como prioritario.`;
    }

    return baseMessage;
  }

  /**
   * Find a conversation by specific lifecycle state
   */
  private async findConversationByState(
    phoneNumber: string,
    lifecycleState: string
  ): Promise<any | null> {
    console.log('[Resolver] findConversationByState looking for:', { phoneNumber, lifecycleState });
    
    const conversation = await ConversationModel.findOne({
      phoneNumber,
      lifecycleState,
    }).sort({ lastActivityAt: -1 }).lean();
    
    if (conversation) {
      console.log('[Resolver] Found conversation:', conversation._id, 'phone:', conversation.phoneNumber);
    } else {
      // Debug: show what conversations exist for this phone
      const allConvs = await ConversationModel.find({ phoneNumber }).sort({ lastActivityAt: -1 }).limit(3).lean();
      console.log('[Resolver] No conversation found. All conversations for this phone:', allConvs.map(c => ({ id: c._id, state: c.lifecycleState, phone: c.phoneNumber })));
    }
    
    return conversation;
  }

  /**
   * Find an active (ACTIVE or WAITING_OPERATOR) conversation for a phone
   */
  private async findActiveConversation(
    phoneNumber: string
  ): Promise<any | null> {
    const conversation = await ConversationModel.findOne({
      phoneNumber,
      lifecycleState: { $in: ['ACTIVE', 'WAITING_OPERATOR'] },
    }).sort({ lastActivityAt: -1 }).lean();
    
    return conversation;
  }

  /**
   * Check if a conversation has expired based on lastActivityAt
   * 
   * IMPORTANT: Only ACTIVE conversations can expire
   * WAITING_OPERATOR conversations should NEVER expire automatically
   */
  private async checkExpiration(conversation: any): Promise<boolean> {
    // WAITING_OPERATOR never expires by timeout
    // Only ACTIVE conversations can expire
    if (conversation.lifecycleState === 'WAITING_OPERATOR') {
      return false;
    }
    
    if (!conversation.lastActivityAt) {
      return false;
    }
    
    const lastActivity = new Date(conversation.lastActivityAt).getTime();
    const now = Date.now();
    const minutesSinceActivity = (now - lastActivity) / (1000 * 60);
    
    if (minutesSinceActivity > CONVERSATION_TIMEOUT_MINUTES) {
      // Mark as expired instead of deleting
      await this.closeConversation(conversation._id.toString(), 'EXPIRED');
      return true;
    }
    
    return false;
  }

  /**
   * Close a conversation with a given state
   */
  private async closeConversation(
    conversationId: string,
    lifecycleState: 'CLOSED' | 'EXPIRED'
  ): Promise<void> {
    await ConversationModel.findByIdAndUpdate(conversationId, {
      $set: {
        lifecycleState,
        closedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log(`[Resolver] Conversation ${conversationId} marked as ${lifecycleState}`);
  }

  /**
   * Close any existing lead conversations when a client writes
   * This ensures the client starts fresh with customer-service flow
   */
  private async closeLeadConversations(phoneNumber: string): Promise<void> {
    // Find any lead conversations (ACTIVE_LEAD, WAITING_OPERATOR, RESOLVED)
    const leadConversations = await ConversationModel.find({
      phoneNumber,
      lifecycleState: { $in: ['ACTIVE_LEAD', 'WAITING_OPERATOR', 'RESOLVED'] },
    });
    
    if (leadConversations.length > 0) {
      console.log(`[Resolver] Found ${leadConversations.length} lead conversation(s) to close`);
      
      for (const conv of leadConversations) {
        // Only update if not already resolved
        if (conv.lifecycleState !== 'RESOLVED') {
          await ConversationModel.findByIdAndUpdate(conv._id, {
            $set: {
              lifecycleState: 'RESOLVED',
              resolvedAt: new Date(),
              updatedAt: new Date(),
            },
          });
          console.log(`[Resolver] Closed lead conversation ${conv._id}`);
        }
      }
    }
    
    // IMPORTANT: Don't close client conversations here - they should be reused or create new
    // The logic for client conversations (ACTIVE_CLIENT, WAITING_CLIENT) is handled separately
    // in the main resolver flow
  }

  /**
   * Close any existing client conversations when needed
   * This handles client-specific conversation lifecycle
   */
  private async closeClientConversations(phoneNumber: string): Promise<void> {
    // Find any client conversations (ACTIVE_CLIENT, WAITING_CLIENT, RESOLVED)
    const clientConversations = await ConversationModel.find({
      phoneNumber,
      lifecycleState: { $in: ['ACTIVE_CLIENT', 'WAITING_CLIENT', 'RESOLVED'] },
    });
    
    if (clientConversations.length > 0) {
      console.log(`[Resolver] Found ${clientConversations.length} client conversation(s) to close`);
      
      for (const conv of clientConversations) {
        // Only update if not already resolved
        if (conv.lifecycleState !== 'RESOLVED') {
          await ConversationModel.findByIdAndUpdate(conv._id, {
            $set: {
              lifecycleState: 'RESOLVED',
              resolvedAt: new Date(),
              updatedAt: new Date(),
            },
          });
          console.log(`[Resolver] Closed client conversation ${conv._id}`);
        }
      }
    }
  }

  /**
   * Create a new conversation
   */
  private async createNewConversation(
    phoneNumber: string,
    tenantId: string,
    leadId: string,
    flowConfig: { id: string; initialState: string },
    lifecycleState: string = 'ACTIVE'
  ): Promise<ResolvedConversation> {
    const now = new Date();
    
    // Prepare leadId - use a dummy ObjectId if not provided
    let leadIdObj;
    try {
      leadIdObj = leadId ? new Types.ObjectId(leadId) : new Types.ObjectId();
    } catch (e) {
      leadIdObj = new Types.ObjectId();
    }
    
    const conversation = await ConversationModel.create({
      tenantId: new Types.ObjectId(tenantId),
      leadId: leadIdObj,
      phoneNumber,
      lifecycleState,
      state: 'idle',
      context: {
        hasEmergencyKeywords: false,
        hasProjectKeywords: false,
        messageContainsData: false,
        userAskedForHuman: false,
      },
      step: 0,
      lastActivityAt: now,
      lastMessageAt: now,
      startedAt: now,
      expiresAt: new Date(now.getTime() + CONVERSATION_TIMEOUT_MINUTES * 60 * 1000),
      waitingMessageCount: 0,
      waitingPriority: WaitingPriority.NORMAL,
      flowType: flowConfig.id, // Guardar el tipo de flow (lead-qualification o customer-service)
    });
    
    console.log('[Resolver] Created new ACTIVE conversation:', conversation._id);
    
    return {
      conversation: {
        id: conversation._id.toString(),
        phoneNumber,
        leadId,
        lifecycleState: 'ACTIVE',
      },
      shouldContinue: true,
      isWaitingForOperator: false,
      isNew: true,
      flowConfig,
    };
  }

  /**
   * Mark a conversation as waiting state
   */
  async markAsWaitingState(conversationId: string, waitingState: 'WAITING_OPERATOR' | 'WAITING_CLIENT'): Promise<void> {
    await ConversationModel.findByIdAndUpdate(conversationId, {
      $set: {
        lifecycleState: waitingState,
        closedAt: new Date(),
        updatedAt: new Date(),
        waitingMessageCount: 0,
        waitingPriority: WaitingPriority.NORMAL,
      },
    });
    console.log(`[Resolver] Conversation ${conversationId} marked as ${waitingState}`);
  }

  /**
   * Operator takes control of the conversation
   * Bot will no longer respond to messages
   */
  async takeControl(conversationId: string, userId: string): Promise<void> {
    await ConversationModel.findByIdAndUpdate(conversationId, {
      $set: {
        owner: 'OPERATOR',
        lifecycleState: 'IN_PROGRESS',
        assignedToUserId: new Types.ObjectId(userId),
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      },
      $push: {
        waitingEvents: {
          event: 'OPERATOR_TOOK_CONTROL',
          timestamp: new Date(),
          priority: 'normal',
        },
      },
    });
    console.log(`[Resolver] Conversation ${conversationId} taken over by operator ${userId}`);
  }

  /**
   * Operator marks conversation as resolved
   * Starts the 72-hour reuse window
   */
  async markAsResolved(conversationId: string, userId: string): Promise<void> {
    const now = new Date();
    await ConversationModel.findByIdAndUpdate(conversationId, {
      $set: {
        owner: 'OPERATOR',
        lifecycleState: 'RESOLVED',
        resolvedAt: now,
        closedAt: now,
        updatedAt: now,
      },
      $push: {
        waitingEvents: {
          event: 'OPERATOR_RESOLVED',
          timestamp: now,
          priority: 'normal',
        },
      },
    });
    console.log(`[Resolver] Conversation ${conversationId} marked as RESOLVED`);
  }

  /**
   * Check if conversation is within reuse window (72 hours)
   * and should be reused instead of creating new
   */
  private isWithinReuseWindow(conversation: any): boolean {
    if (!conversation.resolvedAt) return false;
    
    const resolvedTime = new Date(conversation.resolvedAt).getTime();
    const now = Date.now();
    const timeSinceResolved = now - resolvedTime;
    
    return timeSinceResolved < CONVERSATION_REUSE_WINDOW_MS;
  }

  /**
   * Handle customer reply within reuse window
   * Reuse conversation, notify operator, increase priority
   */
  private async handleReuseWindow(
    conversation: any,
    normalizedPhone: string,
    tenantId: string,
    leadId: string,
    flowConfig: { id: string; initialState: string },
    waitingState: 'WAITING_OPERATOR' | 'WAITING_CLIENT'
  ): Promise<ResolvedConversation> {
    const messageCount = (conversation.waitingMessageCount || 0) + 1;
    const priority = this.calculatePriority(messageCount);
    
    // Update conversation: back to waiting, increment count, add event
    await ConversationModel.findByIdAndUpdate(conversation._id, {
      $set: {
        lifecycleState: waitingState,
        waitingMessageCount: messageCount,
        waitingPriority: priority,
        lastActivityAt: new Date(),
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      },
      $push: {
        waitingEvents: {
          event: 'CUSTOMER_REPLIED_AFTER_RESOLVED' as ConversationLifecycleEvent,
          timestamp: new Date(),
          priority: priority,
        },
      },
    });
    
    // Get customer name for personalized message
    const engineData = conversation.engineData as Record<string, unknown> | undefined;
    const customerName = engineData?.customerName as string | undefined;
    
    const waitingMessage = waitingState === 'WAITING_CLIENT'
      ? this.getClientWaitingMessage(priority, customerName)
      : this.getWaitingMessage(priority);
    
    console.log(`[Resolver] 🔄 REUSE: Customer replied within 72h, conversation ${conversation._id} reused`);
    
    return {
      conversation: {
        id: conversation._id.toString(),
        phoneNumber: normalizedPhone,
        leadId: conversation.leadId?.toString() || leadId,
        lifecycleState: waitingState,
        engineData,
        waitingMessageCount: messageCount,
        waitingPriority: priority,
      },
      shouldContinue: false,
      isWaitingForOperator: true,
      isNew: false,
      waitingEvent: 'CUSTOMER_REPLIED_AFTER_RESOLVED',
      waitingMessage,
      flowConfig,
      profileName: conversation.profileName,
    };
  }

  /**
   * Close a conversation manually (when operator takes action)
   */
  async closeConversationManually(conversationId: string): Promise<void> {
    await this.closeConversation(conversationId, 'CLOSED');
  }

  /**
   * Get conversations waiting for operator with their priorities
   * Useful for CRM to show pending conversations
   */
  async getWaitingConversations(tenantId: string): Promise<any[]> {
    await connectDB();
    
    return ConversationModel.find({
      tenantId: new Types.ObjectId(tenantId),
      lifecycleState: 'WAITING_OPERATOR',
    })
      .sort({ waitingPriority: -1, lastActivityAt: 1 })
      .lean();
  }
}

// Singleton instance
export const conversationResolver = new ConversationResolver();