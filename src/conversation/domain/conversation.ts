import { Document, Types } from 'mongoose';

export type ConversationState =
  | 'idle'
  | 'greeting'
  | 'need_type_asked'
  | 'need_type_captured'
  | 'detail_asked'
  | 'detail_captured'
  | 'customer_type_asked'
  | 'customer_type_captured'
  | 'urgency_asked'
  | 'urgency_captured'
  | 'location_asked'
  | 'location_captured'
  | 'equipment_asked'
  | 'equipment_captured'
  | 'evaluate'
  | 'scored'
  | 'handoff_pending'
  | 'human_assigned'
  | 'closed'
  | 'timeout'
  | 'fallback';

/**
 * Lifecycle states for Conversation entity
 * These represent the life cycle of the conversation, NOT the bot FSM states
 * Separated by type: LEAD vs CLIENT
 */
export type ConversationLifecycleState = 
  | 'ACTIVE_LEAD'      // Bot actively collecting data from lead
  | 'ACTIVE_CLIENT'    // Bot actively collecting data from client
  | 'WAITING_OPERATOR' // Lead completed flow, waiting for human
  | 'WAITING_CLIENT'   // Client completed flow, waiting for human
  | 'IN_PROGRESS'      // Operator took control, bot not responding
  | 'RESOLVED'         // Conversation resolved by operator
  | 'CLOSED'           // Conversation finished successfully
  | 'EXPIRED';         // Conversation expired due to inactivity

/**
 * Conversation owner - determines who responds to messages
 */
export type ConversationOwner = 'BOT' | 'OPERATOR';

/**
 * Conversation type - completely separates lead and customer conversations
 */
export type ConversationType = 'lead' | 'customer';

/**
 * Reuse window duration in milliseconds (72 hours)
 */
export const CONVERSATION_REUSE_WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours

export type InquiryReason = 'repair' | 'installation' | 'maintenance' | 'budget' | 'other' | 'general';
export type CustomerType = 'residential' | 'commercial';
export type UrgencyLevel = 'high' | 'medium' | 'low';
export type HandoffStatus = 'pending' | 'assigned' | 'completed' | 'cancelled';

/**
 * Events that can occur during conversation lifecycle
 */
export type ConversationLifecycleEvent = 
  | 'CUSTOMER_FOLLOW_UP'              // Client sent message while waiting
  | 'CUSTOMER_SENT_REMINDER'          // Client sent multiple messages while waiting
  | 'CUSTOMER_REPLIED_AFTER_RESOLVED' // Client replied within 72h after resolution
  | 'OPERATOR_TOOK_CONTROL'           // Operator clicked "Take control"
  | 'OPERATOR_RESOLVED'               // Operator clicked "Mark as resolved"
  | 'CONVERSATION_EXPIRED';           // Conversation expired

// Domain Events
export interface LeadContactEstablished {
  type: 'LeadContactEstablished';
  leadId: string;
  tenantId: string;
  timestamp: Date;
  trigger: 'message_with_data'; // Qué condición lo disparó
}

export interface ConversationContext {
  userName?: string;
  profileName?: string;
  needType?: InquiryReason;
  customerType?: CustomerType;
  urgency?: UrgencyLevel;
  location?: string;
  equipmentType?: string;
  detail?: string;
  hasEmergencyKeywords: boolean;
  hasProjectKeywords: boolean;
  messageContainsData: boolean;
  userAskedForHuman: boolean;
}

export interface IConversation extends Document {
  tenantId: Types.ObjectId;
  leadId: Types.ObjectId;
  
  // State (FSM state - what step the bot is in)
  state: ConversationState;
  previousState?: ConversationState;
  
  // Lifecycle state (ACTIVE, WAITING_OPERATOR, CLOSED, EXPIRED)
  lifecycleState: ConversationLifecycleState;
  
  // Conversation type - completely separates lead and customer
  conversationType: ConversationType;
  
  // Owner - who controls the conversation (BOT or OPERATOR)
  owner: ConversationOwner;
  
  // Flow completion - user confirmed all info is correct
  isComplete: boolean;
  
  // Context
  context: ConversationContext;
  
  // Control
  step: number;
  fallbackCount: number;
  timeoutCount: number;
  exchangesInSameState: number;
  lastMessageAt: Date;
  lastActivityAt: Date;
  expiresAt?: Date;
  
  // Handoff
  handoffStatus?: HandoffStatus;
  handoffReason?: string;
  assignedToUserId?: Types.ObjectId;
  
  // Timestamps
  startedAt: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConversationInput {
  tenantId: string | Types.ObjectId;
  leadId: string | Types.ObjectId;
  phone: string;
  userName?: string;
}

export interface UpdateConversationInput {
  state?: ConversationState;
  previousState?: ConversationState;
  context?: Partial<ConversationContext>;
  step?: number;
  fallbackCount?: number;
  timeoutCount?: number;
  lastMessageAt?: Date;
  handoffStatus?: HandoffStatus;
  handoffReason?: string;
  assignedToUserId?: string | Types.ObjectId;
  closedAt?: Date;
}