import type {
  ConversationState,
  ConversationContext,
  InquiryReason,
  CustomerType,
  UrgencyLevel,
  LeadContactEstablished,
} from '../domain/conversation';
import type { Temperature, ScoringBreakdown } from '../../leads/types/lead';

export interface ConversationScoringBreakdown {
  urgency: number;
  needClarity: number;
  customerType: number;
  location: number;
  equipmentType: number;
  emergencyBonus: number;
  projectBonus: number;
  humanRequestBonus: number;
}

// Conversación como documento plano (sin Mongoose)
export interface Conversation {
  _id: string;
  tenantId: string;
  leadId: string;

  // State
  state: ConversationState;
  previousState?: ConversationState;

  // Context
  context: ConversationContext;

  // Control
  step: number;
  fallbackCount: number;
  timeoutCount: number;
  exchangesInSameState: number;
  lastMessageAt: Date;

  // Handoff
  handoffStatus?: 'pending' | 'assigned' | 'completed' | 'cancelled';
  handoffReason?: string;
  assignedToUserId?: string;

  // Timestamps
  startedAt: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConversationInput {
  tenantId: string;
  leadId: string;
}

export interface UpdateConversationInput {
  state?: ConversationState;
  previousState?: ConversationState;
  context?: Partial<ConversationContext>;
  step?: number;
  fallbackCount?: number;
  timeoutCount?: number;
  exchangesInSameState?: number;
  lastMessageAt?: Date;
  handoffStatus?: 'pending' | 'assigned' | 'completed' | 'cancelled';
  handoffReason?: string;
  assignedToUserId?: string;
  closedAt?: Date;
}

export type BotAction =
  | { type: 'send_message'; content: string }
  | { type: 'update_lead'; leadId: string; updates: Partial<LeadUpdate> }
  | { type: 'trigger_handoff'; conversationId: string; reason: string; priority: string }
  | { type: 'close_conversation'; conversationId: string }
  | { type: 'emit_domain_event'; event: LeadContactEstablished };

// Campos del Lead que el bot puede actualizar
export interface LeadUpdate {
  inquiryReason?: InquiryReason;
  customerType?: CustomerType;
  temperature?: Temperature;
  score?: number;
  isB2B?: boolean;
  scoringBreakdown?: ScoringBreakdown;
  notes?: string;
  status?: 'new' | 'contacted';
}
