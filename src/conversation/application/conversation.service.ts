import { Types } from 'mongoose';
import type {
  ConversationState,
  ConversationContext,
  IConversation,
} from '../domain/conversation';
import ConversationModel from '../models/conversation';
import ClientModel from '@/crm/models/client';
import type { Conversation, CreateConversationInput, UpdateConversationInput } from './types';

export interface FindOrCreateResult {
  conversation: Conversation;
  isNew: boolean;
}

export class ConversationService {
/**
    * Busca una conversación existente o crea una nueva
    * (el flow nuevo de 7 ramas)
* Retorna la conversación y un flag indicando si es nueva
   */
  async findOrCreate(input: CreateConversationInput): Promise<FindOrCreateResult> {
    const { tenantId, leadId, clientId, phone } = input;
    
    // ============================================================
    // SOLO para CLIENTE: buscar por clientId directamente
    // Si hay conversación activa, usarla. Si no, crear nueva.
    // ============================================================
    if (clientId) {
      console.log('[ConversationService] CLIENT FLOW - checking by clientId:', clientId);
      
      // Buscar SIEMPRE la más reciente (sin importar estado) y verificar si está activa
      const latestConversation = await ConversationModel.findOne({
        tenantId: new Types.ObjectId(tenantId),
        $or: [
          { 'context.clientId': clientId },
          { leadId: new Types.ObjectId(clientId) }
        ],
      }).sort({ lastMessageAt: -1 });
      
      console.log('[ConversationService] DEBUG latest conversation:', {
        id: latestConversation?._id,
        state: latestConversation?.state,
        closedAt: latestConversation?.closedAt
      });
      
// Si hay conversación y está ABIERTA, usarla
      if (latestConversation && !['closed', 'human_assigned'].includes(latestConversation.state)) {
        console.log('[ConversationService] CLIENT - using active conversation:', latestConversation._id, 'state:', latestConversation.state);
        
        // Obtener datos frescos del cliente (NO guardar en conversación, usar directamente)
        const clientData = await ClientModel.findById(clientId).lean();
        console.log('[ConversationService] DEBUG clientData:', { fullName: clientData?.fullName, address: clientData?.address });
        
        // Actualizar solo userName (para mostrar en respuestas)
        await ConversationModel.updateOne(
          { _id: latestConversation._id }, 
          { $set: { 'context.userName': clientData?.fullName } }
        );
        
        // Pasar customerAddress en el contexto para que HandleIncoming lo use
        const contextWithAddress = {
          ...latestConversation.context,
          userName: clientData?.fullName,
          customerAddress: clientData?.address,
        };
        
        const updated = await ConversationModel.findById(latestConversation._id).lean();
        return { 
          conversation: { ...this.toConversation(updated!), context: contextWithAddress }, 
          isNew: false 
        };
      }
      
      // La última conversación está CERRADA o no hay
      // Devolver la conversación cerrada para que HandleIncoming decidа qué hacer
      console.log('[ConversationService] CLIENT - last conversation is closed or not found');
      return { 
        conversation: this.toConversation(latestConversation!), 
        isNew: false 
      };
    }
    
    // ============================================================
    // Para LEADS: buscar conversación previa (comportamiento normal)
    // ============================================================
      console.log('[ConversationService] Created new conversation for client with fresh data:', {
        conversationId: newConversation._id,
        clientId,
        hasAddress: !!clientData?.address,
        address: clientData?.address
      });
      
      return { conversation: this.toConversation(newConversation), isNew: true };
    }
    
    // ============================================================
    // Para LEADS: buscar conversación previa (comportamiento normal)
    // ============================================================
    
    if (clientId || (phone && !leadId)) {
      // Es cliente - buscar por teléfono
      conversationType = 'customer';
      lifecycleState = 'ACTIVE_CLIENT';
      
      if (phone) {
        // Buscar por teléfono normalizado
        const normalizedPhone = phone.replace(/\D/g, '');
        const last9 = normalizedPhone.slice(-9);
        searchQuery = {
          tenantId: new Types.ObjectId(tenantId),
          phoneNumber: { $regex: `(549)?${last9}$` },
          conversationType: 'customer',
        };
      } else if (clientId) {
        // Buscar por clientId en el contexto o como leadId
        searchQuery = {
          tenantId: new Types.ObjectId(tenantId),
          $or: [
            { leadId: new Types.ObjectId(clientId) },
            { 'context.clientId': clientId },
          ],
          conversationType: 'customer',
        };
      }
    } else if (leadId) {
      // Es lead - buscar por leadId
      searchQuery.leadId = new Types.ObjectId(leadId);
    }
    
    // Primero buscar si existe una conversación activa (no cerrada)
    const existing = await ConversationModel.findOne({
      ...searchQuery,
      state: { $nin: ['closed', 'human_assigned'] },
    }).sort({ lastMessageAt: -1 });

    // Si existe y no está cerrada, retornarla
    if (existing) {
      console.log('[ConversationService] Found existing active conversation:', existing.state, '| type:', existing.conversationType);
      
      // Si es cliente (conversación existente es de tipo customer) y no tiene datos en el contexto, actualizar
      // Buscar clientId: puede venir como parámetro O estar en engineData
      const effectiveClientId = clientId || (existing.engineData as any)?.clientId;
      if (effectiveClientId && existing.conversationType === 'customer') {
        const clientData = await ClientModel.findById(effectiveClientId).lean();
        if (clientData) {
          const updates: any = {};
          if (clientData.fullName && !existing.context?.customerName) {
            updates['context.customerName'] = clientData.fullName;
          }
          if (clientData.address && !existing.context?.customerAddress) {
            updates['context.customerAddress'] = clientData.address;
          }
          if (clientData.locality && !existing.context?.customerLocality) {
            updates['context.customerLocality'] = clientData.locality;
          }
          if (clientData.province && !existing.context?.customerProvince) {
            updates['context.customerProvince'] = clientData.province;
          }
          
          if (Object.keys(updates).length > 0) {
            await ConversationModel.updateOne({ _id: existing._id }, { $set: updates });
            console.log('[ConversationService] Updated existing conversation with client data:', Object.keys(updates));
            // Recargar para devolver datos frescos
            const updated = await ConversationModel.findById(existing._id).lean();
            if (updated) {
              return { conversation: this.toConversation(updated), isNew: false };
            }
          }
        }
      }
      
      return { conversation: this.toConversation(existing), isNew: false };
    }

    // Buscar la última conversación aunque esté cerrada (para no crear nueva si ya cerró)
    const lastConversation = await ConversationModel.findOne(searchQuery).sort({ lastMessageAt: -1 });

    // Si ya existe pero está cerrada, retornarla (el caller la ignorará)
    if (lastConversation && (lastConversation.state === 'closed' || lastConversation.state === 'human_assigned')) {
      console.log('[ConversationService] Found closed conversation, returning for ignore:', lastConversation.state);
      return { conversation: this.toConversation(lastConversation), isNew: false };
    }

    // Si no existe, crear nueva desde greeting_personalized (no más idle)
    const now = new Date();

    // Cargar datos del cliente si tenemos clientId (para obtener dirección, etc.)
    let clientData: { fullName?: string; address?: string; locality?: string; province?: string } | null = null;
    if (clientId) {
      try {
        clientData = await ClientModel.findById(clientId).lean() as typeof clientData;
      } catch (e) {
        console.error('[ConversationService] Error loading client data:', e);
      }
    }
    
    // Construir el objeto de conversación
    const conversationData: any = {
      tenantId: new Types.ObjectId(tenantId),
      state: 'greeting_personalized', // Siempre iniciar en greeting_personalized
      context: {
        hasEmergencyKeywords: false,
        hasProjectKeywords: false,
        messageContainsData: false,
        userAskedForHuman: false,
        // Agregar datos del cliente al contexto
        ...(clientData?.fullName && { customerName: clientData.fullName }),
        ...(clientData?.address && { customerAddress: clientData.address }),
        ...(clientData?.locality && { customerLocality: clientData.locality }),
        ...(clientData?.province && { customerProvince: clientData.province }),
      },
      step: 0,
      fallbackCount: 0,
      timeoutCount: 0,
      exchangesInSameState: 0,
      lastMessageAt: now,
      lastActivityAt: now,
      startedAt: now,
      conversationType,
      lifecycleState,
      owner: 'BOT',
    };
    
    // Agregar leadId si existe (para clientes puede estar vacío)
    if (leadId) {
      conversationData.leadId = new Types.ObjectId(leadId);
    }
    
    // Agregar phoneNumber si existe
    if (phone) {
      conversationData.phoneNumber = phone;
    }
    
    // Si es cliente, agregar clientId como campo directo Y en context
    if (clientId) {
      conversationData.clientId = new Types.ObjectId(clientId);
      conversationData.context.clientId = clientId;
      conversationData.context.isCustomer = true;
    }

    const conversation = new ConversationModel(conversationData);

    await conversation.save();
    console.log('[ConversationService] Created new conversation:', conversation.state);
    return { conversation: this.toConversation(conversation), isNew: true };
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
    console.log('[ConversationService.update] CALLED with:', { conversationId, updates });
    
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

    console.log('[ConversationService.update] setOps:', setOps);
    
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
      conversationType: (doc as any).conversationType || 'lead',
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
