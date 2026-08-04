import { Types } from 'mongoose';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import { selectFlow } from '@/conversation/flow-selector';
import type { ConversationLifecycleState } from '@/conversation/domain/conversation';

const CONVERSATION_TIMEOUT_MINUTES = 30;

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
   * Main entry point - resolves which conversation to use for an incoming message
   */
  async getConversationForIncomingMessage(
    phoneNumber: string,
    tenantId: string,
    leadId: string
  ): Promise<ResolvedConversation> {
    await connectDB();
    
    const normalizedPhone = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
    
    // Select flow first (independent of conversation state)
    const flowConfig = await selectFlow(normalizedPhone, tenantId);
    
    // Try to find existing conversation
    const existing = await this.findActiveConversation(normalizedPhone);
    
    if (!existing) {
      // No active conversation - create new
      console.log('[Resolver] No active conversation, creating new');
      return this.createNewConversation(normalizedPhone, tenantId, leadId, flowConfig);
    }
    
    // Check if conversation has expired (only for ACTIVE state)
    const isExpired = await this.checkExpiration(existing);
    if (isExpired) {
      console.log('[Resolver] Conversation expired, creating new');
      return this.createNewConversation(normalizedPhone, tenantId, leadId, flowConfig);
    }
    
    // Check lifecycle state
    if (existing.lifecycleState === 'WAITING_OPERATOR') {
      return this.handleWaitingOperator(existing, normalizedPhone, tenantId, leadId, flowConfig);
    }
    
    // ACTIVE conversation exists - continue
    console.log('[Resolver] Active conversation found, continuing');
    return {
      conversation: {
        id: existing._id.toString(),
        phoneNumber: normalizedPhone,
        leadId: existing.leadId?.toString() || leadId,
        lifecycleState: 'ACTIVE',
        engineData: existing.engineData as Record<string, unknown> | undefined,
      },
      shouldContinue: true,
      isWaitingForOperator: false,
      isNew: false,
      flowConfig,
    };
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