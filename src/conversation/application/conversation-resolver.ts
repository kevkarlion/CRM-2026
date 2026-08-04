import { Types } from 'mongoose';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import { selectFlow } from '@/conversation/flow-selector';
import type { ConversationLifecycleState } from '@/conversation/domain/conversation';

const CONVERSATION_TIMEOUT_MINUTES = 30;

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
  };
  /** Whether to continue the existing conversation or start fresh */
  shouldContinue: boolean;
  /** Whether the conversation is waiting for operator */
  isWaitingForOperator: boolean;
  /** Whether a new conversation was created */
  isNew: boolean;
  /** Message to send back if waiting for operator */
  waitingMessage?: string;
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
 * - Check expiration
 * - Close expired conversations
 * - Create new conversations when needed
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
    
    // Check if conversation has expired
    const isExpired = await this.checkExpiration(existing);
    if (isExpired) {
      console.log('[Resolver] Conversation expired, creating new');
      return this.createNewConversation(normalizedPhone, tenantId, leadId, flowConfig);
    }
    
    // Check lifecycle state
    if (existing.lifecycleState === 'WAITING_OPERATOR') {
      // Check time since last activity
      const lastActivity = existing.lastActivityAt ? new Date(existing.lastActivityAt).getTime() : 0;
      const now = Date.now();
      const minutesSinceActivity = (now - lastActivity) / (1000 * 60);
      
      if (minutesSinceActivity < CONVERSATION_TIMEOUT_MINUTES) {
        // Still waiting - don't restart
        console.log('[Resolver] Conversation waiting for operator, less than 30 min');
        return {
          conversation: {
            id: existing._id.toString(),
            phoneNumber: normalizedPhone,
            leadId: existing.leadId?.toString() || leadId,
            lifecycleState: 'WAITING_OPERATOR',
            engineData: existing.engineData as Record<string, unknown> | undefined,
          },
          shouldContinue: false,
          isWaitingForOperator: true,
          isNew: false,
          waitingMessage: 'Ya registramos tu solicitud. En breve un asesor continuará la conversación.',
          flowConfig,
        };
      } else {
        // More than 30 minutes - close old and create new
        console.log('[Resolver] Waiting > 30 min, closing and creating new');
        await this.closeConversation(existing._id.toString(), 'EXPIRED');
        return this.createNewConversation(normalizedPhone, tenantId, leadId, flowConfig);
      }
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
   */
  private async checkExpiration(conversation: any): Promise<boolean> {
    if (conversation.lifecycleState === 'WAITING_OPERATOR') {
      // WAITING_OPERATOR conversations are checked separately based on time
      return false;
    }
    
    if (!conversation.lastActivityAt) {
      return false;
    }
    
    const lastActivity = new Date(conversation.lastActivityAt).getTime();
    const now = Date.now();
    const minutesSinceActivity = (now - lastActivity) / (1000 * 60);
    
    if (minutesSinceActivity > CONVERSATION_TIMEOUT_MINUTES) {
      // Mark as expired
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
      },
    });
    console.log(`[Resolver] Conversation ${conversationId} marked as WAITING_OPERATOR`);
  }

  /**
   * Close a conversation manually
   */
  async closeConversationManually(conversationId: string): Promise<void> {
    await this.closeConversation(conversationId, 'CLOSED');
  }
}

// Singleton instance
export const conversationResolver = new ConversationResolver();
