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
 */
export type ConversationLifecycleState = 
  | 'ACTIVE'      // Bot is actively collecting data
  | 'WAITING_OPERATOR'  // Bot completed, waiting for human
  | 'CLOSED'      // Conversation finished successfully
  | 'EXPIRED';    // Conversation expired due to inactivity

export type InquiryReason = 'repair' | 'installation' | 'maintenance' | 'budget' | 'other' | 'general';
export type CustomerType = 'residential' | 'commercial';
export type UrgencyLevel = 'high' | 'medium' | 'low';
export type HandoffStatus = 'pending' | 'assigned' | 'completed' | 'cancelled';

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