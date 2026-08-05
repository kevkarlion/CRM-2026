import { Types } from 'mongoose';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import LeadModel from '@/leads/models/lead';
import ContactModel from '@/crm/models/contact';
import { LEAD_QUALIFICATION_FLOW, CUSTOMER_SERVICE_FLOW } from '@/conversation/config';
import type { ConversationLifecycleState } from '@/conversation/domain/conversation';

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
    
    // Seleccionar flow según tipo
    const flowConfig = isClient ? CUSTOMER_SERVICE_FLOW : LEAD_QUALIFICATION_FLOW;
    
    console.log('[Resolver] ════════════════════════');
    console.log('[Resolver] Phone:', normalizedPhone);
    console.log('[Resolver] Type:', isClient ? 'CLIENTE' : 'LEAD');
    
    // ===== STEP 2: BUSCAR CONVERSACIÓN ACTIVA =====
    const existing = await this.findActiveConversation(normalizedPhone);
    
    console.log('[Resolver] Active conversation:', existing ? 'YES' : 'NO');
    
    // ===== STEP 3: DECIDIR =====
    
    // Si NO hay conversación → CREAR NUEVA
    if (!existing) {
      console.log('[Resolver] → CREATE NEW');
      return this.createNewConversation(normalizedPhone, tenantId, leadId, flowConfig);
    }
    
    // Si hay, ver si está completa
    const engineData = existing.engineData as Record<string, unknown> | undefined;
    const isComplete = engineData?.complete === true;
    const currentState = engineData?.currentState as string | undefined;
    
    console.log('[Resolver] State:', currentState, '| Complete:', isComplete);
    
    // Si está completa → mensaje según tipo
    if (isComplete) {
      if (isClient) {
        // Cliente con conversación completa → mensaje personalizado
        console.log('[Resolver] → CLIENTE COMPLETO: mensaje personalizado');
        
        // Obtener nombre del cliente desde el contacto ya cargado
        let customerName = 'cliente';
        if (contact?.clientId) {
          const client = contact.clientId as any;
          customerName = client.fullName || client.name || 'cliente';
        }
        
        const waitingMessage = `✨ Estamos procesando tu solicitud, ${customerName}.\n\nUn asesor de Rolo Climatizaciones te contactará en breve.\n\n¡Gracias por contactarnos! 😊`;
        
        return {
          conversation: {
            id: existing._id.toString(),
            phoneNumber: normalizedPhone,
            leadId: leadId,
            lifecycleState: 'WAITING_OPERATOR',
          },
          shouldContinue: false,
          isWaitingForOperator: true,
          isNew: false,
          waitingMessage,
          flowConfig,
          profileName,
        };
      } else {
        // Lead con conversación completa → esperar operador
        console.log('[Resolver] → LEAD COMPLETO: esperar operador');
        return {
          conversation: {
            id: existing._id.toString(),
            phoneNumber: normalizedPhone,
            leadId: leadId,
            lifecycleState: 'WAITING_OPERATOR',
          },
          shouldContinue: false,
          isWaitingForOperator: true,
          isNew: false,
          waitingMessage: WAITING_FOR_OPERATOR_MESSAGE,
          flowConfig,
          profileName,
        };
      }
    }
    
    // Si NO está completa → CONTINUAR
    console.log('[Resolver] → CONTINUE');
    return {
      conversation: {
        id: existing._id.toString(),
        phoneNumber: normalizedPhone,
        leadId: existing.leadId?.toString() || leadId,
        lifecycleState: existing.lifecycleState,
        engineData,
      },
      shouldContinue: true,
      isWaitingForOperator: false,
      isNew: false,
      flowConfig,
      profileName,
    };
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
   * Handle a conversation in WAITING_OPERATOR state
   * 
   * Key principles:
   * - NEVER restart the flow while waiting for operator
   * - Return a waiting message
   * - Register event for audit
   * - Increment priority based on message count
   */
  private async handleWaitingOperator(
    conversation: any,
    normalizedPhone: string,
    tenantId: string,
    leadId: string,
    flowConfig: { id: string; initialState: string }
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
      },
      $push: {
        waitingEvents: {
          event: waitingEvent,
          timestamp: new Date(),
          priority: priority,
        },
      },
    });
    
    console.log(`[Resolver] WAITING_OPERATOR - Event: ${waitingEvent}, Priority: ${priority}, Count: ${messageCount}`);
    
    return {
      conversation: {
        id: conversation._id.toString(),
        phoneNumber: normalizedPhone,
        leadId: conversation.leadId?.toString() || leadId,
        lifecycleState: 'WAITING_OPERATOR',
        engineData: conversation.engineData as Record<string, unknown> | undefined,
        waitingMessageCount: messageCount,
        waitingPriority: priority,
      },
      shouldContinue: false,
      isWaitingForOperator: true,
      isNew: false,
      waitingEvent,
      waitingMessage: this.getWaitingMessage(priority),
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
   * Create a new conversation
   */
  private async createNewConversation(
    phoneNumber: string,
    tenantId: string,
    leadId: string,
    flowConfig: { id: string; initialState: string }
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
      lifecycleState: 'ACTIVE',
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
   * Mark a conversation as completed (waiting for operator)
   */
  async markAsWaitingOperator(conversationId: string): Promise<void> {
    await ConversationModel.findByIdAndUpdate(conversationId, {
      $set: {
        lifecycleState: 'WAITING_OPERATOR',
        closedAt: new Date(),
        updatedAt: new Date(),
        waitingMessageCount: 0,
        waitingPriority: WaitingPriority.NORMAL,
      },
    });
    console.log(`[Resolver] Conversation ${conversationId} marked as WAITING_OPERATOR`);
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