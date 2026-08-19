import { Types } from 'mongoose';
import type {
  ConversationState,
  ConversationContext,
  IConversation,
} from '../domain/conversation';
import ConversationModel from '../models/conversation';
import type { Conversation, CreateConversationInput, UpdateConversationInput } from './types';

export class ConversationService {
  /**
   * Busca una conversación activa por leadId y tenantId.
   * SIEMPRE crea una nueva conversación en greeting_personalized
   * (el flow nuevo de 7 ramas)
   */
  async findOrCreate(input: CreateConversationInput): Promise<Conversation> {
    // Siempre crear nueva conversación desde greeting_personalized
    // (el flow viejo no se usa más)
    const now = new Date();
    const conversation = new ConversationModel({
      tenantId: new Types.ObjectId(input.tenantId),
      leadId: new Types.ObjectId(input.leadId),
      state: 'greeting_personalized', // Siempre empezar con el nuevo flow
      context: {
        hasEmergencyKeywords: false,
        hasProjectKeywords: false,
        messageContainsData: false,
        userAskedForHuman: false,
      },
      step: 0,
      fallbackCount: 0,
      timeoutCount: 0,
      exchangesInSameState: 0,
      lastMessageAt: now,
      lastActivityAt: now,
      startedAt: now,
      lifecycleState: 'ACTIVE_LEAD',
      conversationType: 'lead',
      owner: 'BOT',
    });

    await conversation.save();
    return this.toConversation(conversation);
  }

  /**
   * Crea una nueva conversación SIN buscar las existentes.
   * Útil para reiniciar el flow desde cero.
   */
  async createFresh(tenantId: string, leadId: string): Promise<Conversation> {
    const now = new Date();
    const conversation = new ConversationModel({
      tenantId: new Types.ObjectId(tenantId),
      leadId: new Types.ObjectId(leadId),
      state: 'greeting_personalized', // Siempre empezar con el nuevo flow
      context: {
        hasEmergencyKeywords: false,
        hasProjectKeywords: false,
        messageContainsData: false,
        userAskedForHuman: false,
      },
      step: 0,
      fallbackCount: 0,
      timeoutCount: 0,
      exchangesInSameState: 0,
      lastMessageAt: now,
      lastActivityAt: now,
      startedAt: now,
      lifecycleState: 'ACTIVE_LEAD',
    });

    await conversation.save();
    return this.toConversation(conversation);
  }

  /**
   * Actualiza una conversación por ID
   */
  async update(conversationId: string, updates: UpdateConversationInput): Promise<Conversation> {
    // Separar context del resto para usar dot notation (Mongoose $set + subdocument bug)
    const { context, ...rest } = updates;
    const setOps: Record<string, unknown> = { ...rest };

    if (context) {
      for (const [key, value] of Object.entries(context)) {
        if (value !== undefined) {
          setOps[`context.${key}`] = value;
        }
      }
    }

    const doc = await ConversationModel.findByIdAndUpdate(
      new Types.ObjectId(conversationId),
      { $set: setOps },
      { new: true }
    );

    if (!doc) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    return this.toConversation(doc);
  }

  /**
   * Busca una conversación por ID
   */
  async findById(conversationId: string): Promise<Conversation | null> {
    const doc = await ConversationModel.findById(new Types.ObjectId(conversationId));
    return doc ? this.toConversation(doc) : null;
  }

  /**
   * Busca conversaciones de un lead
   */
  async findByLead(leadId: string): Promise<Conversation[]> {
    const docs = await ConversationModel.find({
      leadId: new Types.ObjectId(leadId),
    }).sort({ createdAt: -1 });

    return docs.map(d => this.toConversation(d));
  }

  /**
   * Busca todas las conversaciones de un tenant
   */
  async findByTenant(tenantId: string): Promise<Conversation[]> {
    const docs = await ConversationModel.find({
      tenantId: new Types.ObjectId(tenantId),
    }).sort({ lastMessageAt: -1 });

    return docs.map(d => this.toConversation(d));
  }

  /**
   * Cierra una conversación
   */
  async close(conversationId: string): Promise<void> {
    await ConversationModel.findByIdAndUpdate(
      new Types.ObjectId(conversationId),
      {
        $set: {
          state: 'closed' as ConversationState,
          closedAt: new Date(),
        },
      }
    );
  }

  /**
   * Convierte un documento de Mongoose a nuestro tipo plano
   */
  private toConversation(doc: IConversation): Conversation {
    return {
      _id: String(doc._id),
      tenantId: String(doc.tenantId),
      leadId: String(doc.leadId),
      state: doc.state,
      previousState: doc.previousState,
      context: doc.context,
      step: doc.step,
      fallbackCount: doc.fallbackCount,
      timeoutCount: doc.timeoutCount,
      exchangesInSameState: (doc as unknown as { exchangesInSameState?: number }).exchangesInSameState ?? 0,
      lastMessageAt: doc.lastMessageAt,
      handoffStatus: doc.handoffStatus,
      handoffReason: doc.handoffReason,
      assignedToUserId: doc.assignedToUserId ? String(doc.assignedToUserId) : undefined,
      startedAt: doc.startedAt,
      closedAt: doc.closedAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
