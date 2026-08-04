import { Schema } from 'mongoose';
import type { IConversation, ConversationState, ConversationLifecycleState, HandoffStatus } from '../domain/conversation';

const contextSchema = new Schema(
  {
    userName: { type: String },
    needType: {
      type: String,
      enum: ['repair', 'installation', 'maintenance', 'budget', 'other', 'general'],
    },
    customerType: {
      type: String,
      enum: ['residential', 'commercial'],
    },
    urgency: {
      type: String,
      enum: ['high', 'medium', 'low'],
    },
    location: { type: String },
    equipmentType: { type: String },
    detail: { type: String },
    hasEmergencyKeywords: { type: Boolean, default: false },
    hasProjectKeywords: { type: Boolean, default: false },
    messageContainsData: { type: Boolean, default: false },
    userAskedForHuman: { type: Boolean, default: false },
  },
  { _id: false }
);

// Flexible schema for conversation engine data (stores currentState, customerName, etc.)
const engineDataSchema = new Schema(
  {
    // Allow any key-value pairs for the conversation engine
  },
  { _id: false, strict: false }
);

export const conversationSchema = new Schema<IConversation>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', index: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', index: true },
    
    // Phone number for WhatsApp identification
    phoneNumber: { type: String, index: true },
    
    // For conversation engine timeout tracking
    lastActivity: { type: Date },

    state: {
      type: String,
      enum: [
        'idle', 'greeting',
        'need_type_asked', 'need_type_captured',
        'detail_asked', 'detail_captured',
        'customer_type_asked', 'customer_type_captured',
        'urgency_asked', 'urgency_captured',
        'location_asked', 'location_captured',
        'equipment_asked', 'equipment_captured',
        'evaluate', 'scored',
        'handoff_pending', 'human_assigned',
        'closed', 'timeout', 'fallback',
      ] as ConversationState[],
      required: true,
      default: 'idle',
      index: true,
    },
    previousState: {
      type: String,
      enum: [
        'idle', 'greeting',
        'need_type_asked', 'need_type_captured',
        'detail_asked', 'detail_captured',
        'customer_type_asked', 'customer_type_captured',
        'urgency_asked', 'urgency_captured',
        'location_asked', 'location_captured',
        'equipment_asked', 'equipment_captured',
        'evaluate', 'scored',
        'handoff_pending', 'human_assigned',
        'closed', 'timeout', 'fallback',
      ] as ConversationState[],
    },

    context: { type: contextSchema, required: true },
    
    // Flexible field for conversation engine data (currentState, customerName, etc.)
    engineData: { type: engineDataSchema, required: false },

    step: { type: Number, default: 0 },
    fallbackCount: { type: Number, default: 0 },
    timeoutCount: { type: Number, default: 0 },
    exchangesInSameState: { type: Number, default: 0 },
    lastMessageAt: { type: Date, required: true },
    lastActivityAt: { type: Date },
    expiresAt: { type: Date },

    // Lifecycle state (not FSM state)
    lifecycleState: {
      type: String,
      enum: ['ACTIVE', 'WAITING_OPERATOR', 'CLOSED', 'EXPIRED'] as ConversationLifecycleState[],
      required: true,
      default: 'ACTIVE',
      index: true,
    },

    handoffStatus: {
      type: String,
      enum: ['pending', 'assigned', 'completed', 'cancelled'] as HandoffStatus[],
    },
    handoffReason: { type: String },
    assignedToUserId: { type: Schema.Types.ObjectId, ref: 'User' },

    startedAt: { type: Date, required: true },
    closedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

// Índices compuestos para queries comunes
conversationSchema.index({ tenantId: 1, leadId: 1, state: 1 });
conversationSchema.index({ tenantId: 1, state: 1, lastMessageAt: -1 });
conversationSchema.index({ tenantId: 1, lifecycleState: 1, lastMessageAt: -1 });
conversationSchema.index({ tenantId: 1, handoffStatus: 1 });
conversationSchema.index({ leadId: 1, createdAt: -1 });
conversationSchema.index({ phoneNumber: 1, lifecycleState: 1 });
