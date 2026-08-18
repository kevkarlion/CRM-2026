import { EventHandler, eventBus } from '@/infrastructure/events/event-bus';
import {
  DomainEvent,
  QuoteSentPayload,
  VisitCreatedPayload,
  SaleConfirmedPayload,
  CustomerFlowCompletedPayload,
  GestionStatusChangedPayload,
  ResolveConvertedLeadPayload,
  LeadResolvedPayload,
  ClientResolvedPayload,
} from '@/infrastructure/events/event.types';
import GestionModel from '../models/gestion';
import LeadModel from '@/leads/models/lead';
import ClientModel from '@/crm/models/client';
import { Types } from 'mongoose';

export const gestionSyncHandler = {
  register(): void {
    const on = (type: string, handler: EventHandler) => eventBus.on(type, handler);

    // Quote sent from customer → quote_sent
    on('QUOTE_SENT', gestionSyncHandler.onQuoteSent as EventHandler);
    
    // Visit scheduled from customer → technical_visit
    on('VISIT_CREATED', gestionSyncHandler.onVisitCreated as EventHandler);
    
    // Sale confirmed → won
    on('SALE_CONFIRMED', gestionSyncHandler.onSaleConfirmed as EventHandler);
    
    // Customer completed bot flow → contacted
    on('CUSTOMER_FLOW_COMPLETED', gestionSyncHandler.onCustomerFlowCompleted as EventHandler);
    
    // Gestion status changed manually → sync
    on('GESTION_STATUS_CHANGED', gestionSyncHandler.onGestionStatusChanged as EventHandler);
    
    // User resolved a lead (from lead card) → close lead, create first Gestion
    on('LEAD_RESOLVED', gestionSyncHandler.onLeadResolved as EventHandler);
    
    // User resolved a client/gestion → close Gestion, create new Gestion
    on('CLIENT_RESOLVED', gestionSyncHandler.onClientResolved as EventHandler);

    console.log('[GestionSync] ✅ Handlers registered for: QUOTE_SENT, VISIT_CREATED, SALE_CONFIRMED, CUSTOMER_FLOW_COMPLETED, GESTION_STATUS_CHANGED, LEAD_RESOLVED, CLIENT_RESOLVED');
  },

  /**
   * Find active Gestion for a client (status not in ['won', 'lost'])
   */
  async findActiveGestion(clientId: string, tenantId: string): Promise<any | null> {
    return GestionModel.findOne({
      clientId: new Types.ObjectId(clientId),
      tenantId: new Types.ObjectId(tenantId),
      status: { $nin: ['won', 'lost'] },
    }).lean();
  },

  /**
   * Find client by phone and tenant
   */
  async findClientByPhone(phone: string, tenantId: string): Promise<any | null> {
    return ClientModel.findOne({
      phone,
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    }).lean();
  },

  /**
   * Find lead by ID (used for VISIT_CREATED when no clientId)
   */
  async findLeadById(leadId: string, tenantId: string): Promise<any | null> {
    return LeadModel.findOne({
      _id: new Types.ObjectId(leadId),
      tenantId: new Types.ObjectId(tenantId),
    }).lean();
  },

  /**
   * Update Gestion status
   */
  async updateGestionStatus(gestionId: string, tenantId: string, newStatus: string): Promise<void> {
    try {
      const updated = await GestionModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(gestionId),
          tenantId: new Types.ObjectId(tenantId),
        },
        { $set: { status: newStatus } },
        { new: true }
      );

      if (updated) {
        console.log(`[GestionSync] Updated Gestion ${gestionId} status to ${newStatus}`);
      } else {
        console.log(`[GestionSync] Gestion ${gestionId} not found or already in terminal state`);
      }
    } catch (error) {
      console.error('[GestionSync] Error updating Gestion status:', error);
    }
  },

  /**
   * Handle QUOTE_SENT
   * Payload has clientId - find active Gestion and update to quote_sent
   */
  async onQuoteSent(event: DomainEvent<QuoteSentPayload>): Promise<void> {
    const { clientId } = event.payload;
    const tenantId = event.tenantId;

    if (!clientId) {
      console.log('[GestionSync] QUOTE_SENT: no clientId in payload, skipping');
      return;
    }

    try {
      const gestion = await gestionSyncHandler.findActiveGestion(clientId, tenantId);
      if (!gestion) {
        console.log(`[GestionSync] QUOTE_SENT: no active Gestion for client ${clientId}`);
        return;
      }

      await gestionSyncHandler.updateGestionStatus(String(gestion._id), tenantId, 'quote_sent');
    } catch (error) {
      console.error('[GestionSync] Error in onQuoteSent:', error);
    }
  },

  /**
   * Handle VISIT_CREATED
   * Payload has leadId or clientId - find Gestion and update to technical_visit
   */
  async onVisitCreated(event: DomainEvent<VisitCreatedPayload>): Promise<void> {
    const { clientId, leadId } = event.payload;
    const tenantId = event.tenantId;

    let targetClientId = clientId;

    // If no clientId, find via lead
    if (!targetClientId && leadId) {
      try {
        const lead = await gestionSyncHandler.findLeadById(leadId, tenantId);
        if (lead?.phone) {
          const client = await gestionSyncHandler.findClientByPhone(lead.phone, tenantId);
          targetClientId = client?._id ? String(client._id) : null;
        }
      } catch (error) {
        console.error('[GestionSync] Error finding client from lead:', error);
      }
    }

    if (!targetClientId) {
      console.log('[GestionSync] VISIT_CREATED: no clientId available');
      return;
    }

    try {
      const gestion = await gestionSyncHandler.findActiveGestion(targetClientId, tenantId);
      if (!gestion) {
        console.log(`[GestionSync] VISIT_CREATED: no active Gestion for client ${targetClientId}`);
        return;
      }

      await gestionSyncHandler.updateGestionStatus(String(gestion._id), tenantId, 'technical_visit');
    } catch (error) {
      console.error('[GestionSync] Error in onVisitCreated:', error);
    }
  },

  /**
   * Handle SALE_CONFIRMED
   * Payload has clientId - update Gestion to won
   * NEW: La nueva Gestion se crea cuando el usuario hace click en "Resuelto"
   */
  async onSaleConfirmed(event: DomainEvent<SaleConfirmedPayload>): Promise<void> {
    const { clientId } = event.payload;
    const tenantId = event.tenantId;
    const userId = event.userId || 'system';

    if (!clientId) {
      console.log('[GestionSync] SALE_CONFIRMED: no clientId in payload, skipping');
      return;
    }

    try {
      const gestion = await gestionSyncHandler.findActiveGestion(clientId, tenantId);
      if (!gestion) {
        console.log(`[GestionSync] SALE_CONFIRMED: no active Gestion for client ${clientId}`);
        return;
      }

      // Update current gestion to won (card will stay visible in "Ganado" until resolved)
      await gestionSyncHandler.updateGestionStatus(String(gestion._id), tenantId, 'won');
      console.log(`[GestionSync] SALE_CONFIRMED: Gestion ${gestion._id} marked as won`);
    } catch (error) {
      console.error('[GestionSync] Error in onSaleConfirmed:', error);
    }
  },

  /**
   * Handle CUSTOMER_FLOW_COMPLETED
   * When a customer (already converted) completes the bot flow, update Gestion to contacted
   */
  async onCustomerFlowCompleted(event: DomainEvent<CustomerFlowCompletedPayload>): Promise<void> {
    console.log('[GestionSync] >>> CUSTOMER_FLOW_COMPLETED handler called');
    console.log('[GestionSync] >>> Event payload:', JSON.stringify(event.payload));
    console.log('[GestionSync] >>> tenantId:', event.tenantId);
    
    const { clientId } = event.payload;
    const tenantId = event.tenantId;

    if (!clientId) {
      console.log('[GestionSync] >>> ERROR: no clientId in payload, skipping');
      return;
    }

    // NOTE: No se actualiza la Gestion cuando el cliente escribe.
    // La Gestion se crea solo con "Resuelto" y queda en status "new" (oculta)
    // El usuario debe resolver manualmente desde el pipeline
    console.log(`[GestionSync] CUSTOMER_FLOW_COMPLETED: Customer wrote but Gestion stays as-is (created only on resolve)`);
  },

  /**
   * Handle GESTION_STATUS_CHANGED
   * When Gestion status is manually changed - just log for now
   */
  async onGestionStatusChanged(event: DomainEvent<GestionStatusChangedPayload>): Promise<void> {
    const { gestionId, clientId, from, to, gestionName } = event.payload;
    console.log(`[GestionSync] 🔄 GESTION_STATUS_CHANGED: ${gestionId} | ${from} → ${to} | client: ${clientId} | name: ${gestionName}`);
  },

  /**
   * Handle LEAD_RESOLVED
   * Cuando se hace click en "Resuelto" desde un LEAD:
   * - Lead -> closed
   * - Conversación lead -> resolved
   * - Crear primera Gestion status new
   */
  async onLeadResolved(event: DomainEvent<LeadResolvedPayload>): Promise<void> {
    const { leadId, clientId, resolvedBy } = event.payload;
    const tenantId = event.tenantId;

    if (!clientId || !leadId) {
      console.log('[GestionSync] LEAD_RESOLVED: missing leadId or clientId, skipping');
      return;
    }

    try {
      console.log(`[GestionSync] LEAD_RESOLVED: resolving lead ${leadId} / client ${clientId}`);

      // 1. Close the Lead
      const lead = await LeadModel.findOne({
        _id: new Types.ObjectId(leadId),
        tenantId: new Types.ObjectId(tenantId),
      });

      if (lead) {
        await LeadModel.updateOne(
          { _id: lead._id },
          { $set: { status: 'closed', updatedBy: resolvedBy } }
        );
        console.log(`[GestionSync] LEAD_RESOLVED: Lead ${leadId} marked as closed`);
      }

      // 2. Close any active lead conversation
      const ConversationModel = (await import('@/conversation/models/conversation')).default;
      const phone = (lead as any)?.phone;
      if (phone) {
        const leadConversation = await ConversationModel.findOneAndUpdate(
          { phoneNumber: phone, lifecycleState: { $in: ['ACTIVE_LEAD', 'WAITING_LEAD'] } },
          { $set: { lifecycleState: 'RESOLVED', state: 'resolved' } },
          { new: true }
        );
        if (leadConversation) {
          console.log(`[GestionSync] LEAD_RESOLVED: Lead conversation ${leadConversation._id} closed`);
        }
      }

      // 3. Create first Gestion (new) for this client
      const existingAnyGestion = await GestionModel.findOne({
        clientId: new Types.ObjectId(clientId),
        tenantId: new Types.ObjectId(tenantId),
        status: { $nin: ['won', 'lost', 'closed'] },
      });

      if (existingAnyGestion) {
        console.log(`[GestionSync] LEAD_RESOLVED: active Gestion already exists for client ${clientId}`);
      } else {
        const newGestion = await GestionModel.create({
          clientId: new Types.ObjectId(clientId),
          tenantId: new Types.ObjectId(tenantId),
          name: 'Nueva gestión',
          source: 'whatsapp',
          status: 'new',
          qualificationStatus: 'pending',
          createdBy: resolvedBy,
          updatedBy: resolvedBy,
        });
        console.log(`[GestionSync] LEAD_RESOLVED: First Gestion created: ${newGestion._id}`);
      }
    } catch (error) {
      console.error('[GestionSync] Error in onLeadResolved:', error);
    }
  },

  /**
   * Handle CLIENT_RESOLVED
   * Cuando se hace click en "Resuelto" desde un CLIENTE/GESTION:
   * - Gestion actual won -> closed
   * - Crear nueva Gestion status new
   */
  async onClientResolved(event: DomainEvent<ClientResolvedPayload>): Promise<void> {
    const { clientId, resolvedBy } = event.payload;
    const tenantId = event.tenantId;

    if (!clientId) {
      console.log('[GestionSync] CLIENT_RESOLVED: missing clientId, skipping');
      return;
    }

    try {
      console.log(`[GestionSync] CLIENT_RESOLVED: resolving client ${clientId}`);

      // 1. Close the won Gestion
      const wonGestion = await GestionModel.findOne({
        clientId: new Types.ObjectId(clientId),
        tenantId: new Types.ObjectId(tenantId),
        status: 'won',
      });

      if (wonGestion) {
        await GestionModel.updateOne(
          { _id: wonGestion._id },
          { $set: { status: 'closed', updatedBy: resolvedBy } }
        );
        console.log(`[GestionSync] CLIENT_RESOLVED: Gestion ${wonGestion._id} marked as closed`);
      }

      // 2. Create new Gestion (new)
      const existingAnyGestion = await GestionModel.findOne({
        clientId: new Types.ObjectId(clientId),
        tenantId: new Types.ObjectId(tenantId),
        status: { $nin: ['won', 'lost', 'closed'] },
      });

      if (existingAnyGestion) {
        console.log(`[GestionSync] CLIENT_RESOLVED: active Gestion already exists for client ${clientId}`);
      } else {
        const newGestion = await GestionModel.create({
          clientId: new Types.ObjectId(clientId),
          tenantId: new Types.ObjectId(tenantId),
          name: 'Nueva gestión',
          source: 'whatsapp',
          status: 'new',
          qualificationStatus: 'pending',
          createdBy: resolvedBy,
          updatedBy: resolvedBy,
        });
        console.log(`[GestionSync] CLIENT_RESOLVED: New Gestion created: ${newGestion._id}`);
      }
    } catch (error) {
      console.error('[GestionSync] Error in onClientResolved:', error);
    }
  },
};