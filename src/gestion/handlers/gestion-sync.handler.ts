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
import { addEvent, copyEventsToHistory } from '../utils/gestion-events';

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
    const { clientId, quoteId, number: quoteNumber, total } = event.payload;
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
      
      // Record QUOTE_SENT event
      await addEvent(
        String(gestion._id),
        tenantId,
        'QUOTE_SENT',
        { quoteId, quoteNumber, total },
        event.userId
      );
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
    const { clientId, amount } = event.payload;
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

      // Record SALE_CONFIRMED event
      await addEvent(
        String(gestion._id),
        tenantId,
        'SALE_CONFIRMED',
        { amount },
        userId
      );
    } catch (error) {
      console.error('[GestionSync] Error in onSaleConfirmed:', error);
    }
  },

  /**
   * Handle CUSTOMER_FLOW_COMPLETED
   * When a customer (already converted) completes the bot flow, update Gestion to contacted
   * This makes the Gestion visible in the pipeline
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

    // Find the Gestion for this client (should exist after "Resuelto" was clicked)
    // If it exists and is in "new" status, change to "contacted"
    try {
      // First try to find with status 'new'
      let gestion = await GestionModel.findOne({
        clientId: new Types.ObjectId(clientId),
        tenantId: new Types.ObjectId(tenantId),
        status: 'new',
      }).lean();

      // If not found, try to find any active Gestion
      if (!gestion) {
        gestion = await GestionModel.findOne({
          clientId: new Types.ObjectId(clientId),
          tenantId: new Types.ObjectId(tenantId),
          status: { $nin: ['won', 'lost'] },
        }).lean();
      }

      if (gestion) {
        const oldStatus = gestion.status;
        await GestionModel.updateOne(
          { _id: gestion._id },
          { $set: { status: 'contacted' } }
        );
        console.log(`[GestionSync] CUSTOMER_FLOW_COMPLETED: Gestion ${gestion._id} updated from ${oldStatus} → contacted`);
      } else {
        console.log(`[GestionSync] CUSTOMER_FLOW_COMPLETED: No Gestion found for client ${clientId}`);
      }
    } catch (error) {
      console.error('[GestionSync] Error in onCustomerFlowCompleted:', error);
    }
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
   * - Crear cliente si no existe (desde datos del lead)
   * - Crear primera Gestion status new
   */
  async onLeadResolved(event: DomainEvent<LeadResolvedPayload>): Promise<void> {
    const { leadId, clientId, resolvedBy } = event.payload;
    const tenantId = event.tenantId;

    if (!leadId) {
      console.log('[GestionSync] LEAD_RESOLVED: missing leadId, skipping');
      return;
    }

    try {
      console.log(`[GestionSync] LEAD_RESOLVED: resolving lead ${leadId} / client ${clientId}`);

      // 1. Get the Lead
      const lead = await LeadModel.findOne({
        _id: new Types.ObjectId(leadId),
        tenantId: new Types.ObjectId(tenantId),
      });

      if (!lead) {
        console.log('[GestionSync] LEAD_RESOLVED: lead not found, skipping');
        return;
      }

      // 2. Buscar o crear cliente si no existe
      let finalClientId = clientId;
      let createdNewClient = false;
      
      if (!finalClientId) {
        // Buscar cliente por teléfono
        const existingClient = await ClientModel.findOne({
          phone: lead.phone,
          tenantId: new Types.ObjectId(tenantId),
          deletedAt: null,
        }).lean();

        if (existingClient) {
          finalClientId = String(existingClient._id);
        } else {
          // Crear cliente desde el lead
          const newClient = await ClientModel.create({
            tenantId: new Types.ObjectId(tenantId),
            fullName: lead.name,
            companyName: lead.companyName,
            phone: lead.phone,
            email: lead.email,
            address: lead.address,
            locality: lead.locality,
            province: lead.province,
            source: lead.source,
            status: 'active',
            operationStatus: 'none',
            createdBy: new Types.ObjectId(resolvedBy),
            updatedBy: new Types.ObjectId(resolvedBy),
          });
          finalClientId = String(newClient._id);
          createdNewClient = true;
          console.log(`[GestionSync] LEAD_RESOLVED: Client created from lead: ${finalClientId}`);
        }
      }

      // 3. Actualizar lead con convertedToClient (SIEMPRE, aunque ya tenga clientId)
      await LeadModel.updateOne(
        { _id: lead._id },
        { 
          $set: { 
            status: 'converted', 
            convertedToClient: new Types.ObjectId(finalClientId),
            convertedAt: new Date(),
            clientId: new Types.ObjectId(finalClientId),
            updatedBy: resolvedBy 
          } 
        }
      );
      console.log(`[GestionSync] LEAD_RESOLVED: Lead ${leadId} marked as converted, linked to client ${finalClientId}`);

      // 4. Migrar conversación de lead a cliente (NO cerrar, convertir)
      const ConversationModel = (await import('@/conversation/models/conversation')).default;
      const phone = (lead as any)?.phone;
      if (phone) {
        // Migrar conversación de lead a cliente
        const convResult = await ConversationModel.updateMany(
          { phoneNumber: phone, conversationType: 'lead' },
          {
            $set: {
              clientId: new Types.ObjectId(finalClientId),
              leadId: new Types.ObjectId(leadId),
              conversationType: 'customer',
              lifecycleState: 'ACTIVE_CLIENT',
              state: 'greeting_personalized',
              closedAt: null,
              'engineData.isCustomer': true,
              'engineData.clientId': finalClientId,
            },
          }
        );
        console.log(`[GestionSync] LEAD_RESOLVED: Migrated ${convResult.modifiedCount} conversation(s) to customer`);
      }

      // 5. Create first Gestion (new) for this client
      const existingAnyGestion = await GestionModel.findOne({
        clientId: new Types.ObjectId(finalClientId),
        tenantId: new Types.ObjectId(tenantId),
        status: { $nin: ['won', 'lost'] },
      });

      if (existingAnyGestion) {
        console.log(`[GestionSync] LEAD_RESOLVED: active Gestion already exists for client ${finalClientId}`);
      } else {
        const newGestion = await GestionModel.create({
          clientId: new Types.ObjectId(finalClientId),
          tenantId: new Types.ObjectId(tenantId),
          name: 'Nueva gestión',
          source: lead.source || 'whatsapp',
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
   * Cuando se hace click en "Ciclo terminado" desde un CLIENTE/GESTION:
   * - Gestion actual: cerrar, guardar en historial, crear nueva
   * - Crear nueva Gestion status new
   */
  async onClientResolved(event: DomainEvent<ClientResolvedPayload>): Promise<void> {
    const { clientId, resolvedBy } = event.payload;
    const tenantId = event.tenantId;

    console.log('[CLIENT_RESOLVED] 🚀 START', { clientId, resolvedBy, tenantId });

    if (!clientId) {
      console.log('[CLIENT_RESOLVED] ❌ missing clientId, skipping');
      return;
    }

    try {
      console.log(`[CLIENT_RESOLVED] 🔍 Looking for gestion for client ${clientId} tenant ${tenantId}`);

      // 1. Buscar la gestión ACTIVA (la que NO está lost) - debe haber solo 1
      const activeGestion = await GestionModel.findOne({
        clientId: new Types.ObjectId(clientId),
        tenantId: new Types.ObjectId(tenantId),
        status: { $ne: 'lost' }
      }).sort({ createdAt: -1 });

      console.log('[CLIENT_RESOLVED] 🔍 Gestion found:', activeGestion ? {
        _id: activeGestion._id,
        status: activeGestion.status,
        clientId: activeGestion.clientId,
        tenantId: activeGestion.tenantId,
      } : 'NONE');

      // Verificar si es elegible para cerrar (no lost)
      const isEligible = activeGestion && !['lost'].includes(activeGestion.status);
      console.log('[CLIENT_RESOLVED] 🔍 Is eligible for close:', isEligible, 'status:', activeGestion?.status);

      // Obtener datos del cliente
      console.log('[CLIENT_RESOLVED] 🔍 Fetching client data...');
      const client = await ClientModel.findOne({
        _id: new Types.ObjectId(clientId),
        tenantId: new Types.ObjectId(tenantId),
      }).lean();

      console.log('[CLIENT_RESOLVED] 🔍 Client data:', client ? {
        _id: client._id,
        fullName: client.fullName,
        phone: client.phone,
      } : 'NOT FOUND');

      // Determinar el source y history a usar
      const source = activeGestion?.source || 'whatsapp';
      const existingHistory = activeGestion?.history || [];

      let historyToSave = [...existingHistory];

      if (activeGestion && isEligible) {
        // Copy events to history before closing the gestion
        await copyEventsToHistory(String(activeGestion._id), tenantId);

        // 2. Cerrar gestión actual - guardar en historial
        const historyEntry = {
          closedAt: new Date(),
          finalStatus: activeGestion.status,
          score: activeGestion.score || 0,
          temperature: activeGestion.temperature,
          inquiryReason: activeGestion.inquiryReason,
          estimatedValue: activeGestion.estimatedValue,
          notes: activeGestion.notes,
          adminNotes: activeGestion.adminNotes,
        };

        console.log('[CLIENT_RESOLVED] 📝 Saving history entry:', historyEntry);

        await GestionModel.updateOne(
          { _id: activeGestion._id },
          { 
            $set: { 
              status: 'won', 
              updatedBy: resolvedBy,
            },
            $push: { history: historyEntry }
          }
        );
        
        // Agregar el nuevo entry al historial a copiar
        historyToSave = [...existingHistory, historyEntry];
        console.log(`[CLIENT_RESOLVED] ✅ Gestion ${activeGestion._id} marked as lost, history saved. Total history:`, historyToSave);
      } else if (activeGestion) {
        console.log(`[CLIENT_RESOLVED] ⚠️ Gestion already closed/lost (${activeGestion.status}), just creating new one`);
      } else {
        console.log(`[CLIENT_RESOLVED] ⚠️ No Gestion found, creating first one`);
      }

      // 3. Crear nueva gestión para el nuevo ciclo
      // Siempre crear nueva gestión cuando se hace click en "Ciclo terminado"
      // El status de la gestión anterior no importa
      
      console.log('[CLIENT_RESOLVED] 🔍 Creating new gestion with history:', historyToSave);

      try {
        const newGestion = await GestionModel.create({
          clientId: new Types.ObjectId(clientId),
          tenantId: new Types.ObjectId(tenantId),
          name: 'Nueva gestión',
          source,
          phone: client?.phone,
          address: client?.address,
          locality: client?.locality,
          province: client?.province,
          status: 'contacted', // Nueva gestión siempre empieza en contacted
          qualificationStatus: 'pending',
          history: historyToSave,
          createdBy: resolvedBy,
          updatedBy: resolvedBy,
          createdAt: new Date(), // Ensure it's the most recent
        });
        console.log(`[CLIENT_RESOLVED] ✅ New Gestion created: ${newGestion._id} status=${newGestion.status} createdAt=${newGestion.createdAt}`);
        
        // Verify it was created
        const verify = await GestionModel.findById(newGestion._id);
        console.log('[CLIENT_RESOLVED] 🔍 Verify new gestion:', verify ? { _id: verify._id, status: verify.status } : 'NOT FOUND');

        // 4. Resetear el flujo del bot para el cliente (nuevo ciclo)
        // Esto hace que el bot arrancque fresco sin esperar 48hs
        if (client?.phone) {
          try {
            const ConversationModel = (await import('@/conversation/models/conversation')).default;
            const resetResult = await ConversationModel.updateMany(
              { 
                phoneNumber: client.phone,
                tenantId: new Types.ObjectId(tenantId),
                conversationType: 'customer',
              },
              {
                $set: {
                  state: 'greeting_personalized',
                  lifecycleState: 'ACTIVE_CLIENT',
                  'context.hasEmergencyKeywords': false,
                  'context.hasProjectKeywords': false,
                  'context.messageContainsData': false,
                  'context.userAskedForHuman': false,
                  'context.userName': client.fullName,
                  'context.customerName': client.fullName,
                  'context.customerAddress': client.address,
                  'context.customerLocality': client.locality,
                  'context.customerProvince': client.province,
                  'engineData.isCustomer': true,
                  'engineData.clientId': String(client._id),
                  'engineData.customerName': client.fullName,
                  step: 0,
                  fallbackCount: 0,
                  exchangesInSameState: 0,
                },
                $unset: {
                  closedAt: '',
                  'context.location': '',
                  'context.detail': '',
                  'context.needType': '',
                  'context.urgency': '',
                }
              }
            );
            console.log(`[CLIENT_RESOLVED] 🔄 Bot flow reset for ${client.phone}: ${resetResult.modifiedCount} conversation(s) - context cleaned, client data added`);
          } catch (convError: any) {
            console.error('[CLIENT_RESOLVED] ❌ Error resetting bot flow:', convError?.message);
          }
        }
      } catch (createError: any) {
        if (createError.code === 11000) {
          console.log(`[CLIENT_RESOLVED] ⚠️ Duplicate key error (index), gestion may already exist`);
        } else {
          throw createError;
        }
      }
    } catch (error: any) {
      console.error('[CLIENT_RESOLVED] ❌ Error:', error?.message || error, error?.stack);
    }
  },
};