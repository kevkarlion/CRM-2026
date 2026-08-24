import { Types, ClientSession } from 'mongoose';
import LeadModel from '@/leads/models/lead';
import ClientModel from '@/crm/models/client';
import ContactModel from '@/crm/models/contact';
import QuoteModel from '@/quotes/models/quote';
import QuoteVersionModel from '@/quotes/models/quote-version';
import ConversationModel from '@/conversation/models/conversation';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import GestionModel from '@/gestion/models/gestion';
import { getNextQuoteNumber } from '@/quotes/helpers/counter';
import WorkOrderModel from '@/operations/models/work-order';
import { getNextWorkOrderNumber } from '@/operations/helpers/counter';
import { CommercialProcessService } from '@/crm/services/commercial-process.service';
import { eventBus } from '@/infrastructure/events/event-bus';
import {
  DOMAIN_EVENTS,
  WorkOrderCreatedPayload,
  SaleConfirmedPayload,
} from '@/infrastructure/events/event.types';
import type { LeadStatus } from '@/leads/constants/lead-status.constants';
import type { ILead } from '@/leads/types/lead';
import type { IClient } from '@/crm/types/client';

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface DirectSaleItem {
  description: string;
  type: 'product' | 'service' | 'labor' | 'material' | 'part';
  quantity: number;
  unitPrice: number;
}

export interface SaleConfirmationParams {
  entityType: 'lead' | 'client';
  entityId: string;
  saleMode: 'quotes' | 'direct';
  quoteIds?: string[];
  notes?: string;
  customerType?: string;
  directSale?: {
    amount: number;
    description?: string;
    serviceTypeId?: string;
    items?: DirectSaleItem[];
  };
  tenantId: string;
  userId: string;
}

export interface SaleConfirmationResult {
  success: boolean;
  clientId: string;
  workOrderId: string | null;
  workOrderNumber: string | null;
  totalAmount: number;
  quotesApproved: number;
  saleMode: 'quotes' | 'direct';
  quoteId: string | null;
}

type SaleQuote = { _id: Types.ObjectId; total: number; locationId?: Types.ObjectId };

/**
 * Single source of truth for the sale-confirmation flow.
 *
 * Branches on `entityType`:
 * - 'lead':   converts the lead into a client + work order (original behavior).
 * - 'client': confirms the sale directly on an existing client, never touching
 *             lead state. Blocked clients are rejected with ConflictError.
 *
 * Both paths create a draft work order, link approved quotes (quotes mode) or a
 * direct-sale quote (direct mode), log the commercial activity and publish the
 * WORK_ORDER_CREATED + SALE_CONFIRMED domain events.
 */
export class SaleConfirmationService {
  static async confirmSale(
    params: SaleConfirmationParams,
  ): Promise<SaleConfirmationResult> {
    const {
      entityType,
      entityId,
      saleMode,
      quoteIds,
      notes,
      customerType,
      directSale,
      tenantId,
      userId,
    } = params;
    const resolvedCustomerType = customerType || 'commercial';

    let lead: ILead | null = null;
    let client: IClient | null = null;

    if (entityType === 'lead') {
      lead = await LeadModel.findOne({
        _id: new Types.ObjectId(entityId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      });

      if (!lead) {
        throw new NotFoundError('Lead no encontrado');
      }

      const ALLOWED_FOR_SALE: LeadStatus[] = ['contacted', 'technical_visit', 'quote_sent', 'negotiation'];
      if (!ALLOWED_FOR_SALE.includes(lead.status as LeadStatus)) {
        throw new ValidationError(
          `Lead en estado '${lead.status}' no puede confirmar venta. Estados permitidos: contactado, visita técnica, presupuesto enviado, negociación`,
        );
      }
    } else {
      client = await ClientModel.findOne({
        _id: new Types.ObjectId(entityId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      });

      if (!client) {
        throw new NotFoundError('Cliente no encontrado');
      }

      if (client.status === 'blocked') {
        throw new ConflictError('Cliente bloqueado — no puede operar');
      }
    }

    let totalAmount = 0;
    let quotes: SaleQuote[] = [];
    let quotesApproved = 0;

    if (saleMode === 'quotes' && quoteIds) {
      const ownerField = entityType === 'lead' ? 'leadId' : 'clientId';
      const ownerId =
        entityType === 'lead'
          ? new Types.ObjectId(entityId)
          : client!._id;

      const foundQuotes = await QuoteModel.find({
        _id: { $in: quoteIds.map((id) => new Types.ObjectId(id)) },
        [ownerField]: ownerId,
        status: 'approved',
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      }).lean();

      quotes = foundQuotes as unknown as SaleQuote[];

      if (quotes.length !== quoteIds.length) {
        throw new ValidationError('Algunos presupuestos no son válidos');
      }

      totalAmount = quotes.reduce((sum, q) => sum + (q.total || 0), 0);
    } else if (saleMode === 'direct' && directSale) {
      totalAmount = directSale.amount;
    }

    const session = await require('mongoose').startSession();
    session.startTransaction();

    try {
      // 1. Registrar la venta sobre los presupuestos aprobados
      if (saleMode === 'quotes' && quoteIds && quotes.length > 0) {
        await QuoteModel.updateMany(
          { _id: { $in: quoteIds.map((id) => new Types.ObjectId(id)) } },
          {
            $set: {
              status: 'approved',
              approvedAt: new Date(),
              updatedBy: new Types.ObjectId(userId),
            },
          },
          { session }
        );
        quotesApproved = quoteIds.length;
      }

      // 2. Crear u obtener el cliente
      let clientId: Types.ObjectId;
      if (entityType === 'lead') {
        clientId = await SaleConfirmationService.getOrCreateClientFromLead({
          lead: lead!,
          saleMode,
          quotes,
          directSale,
          notes,
          resolvedCustomerType,
          totalAmount,
          tenantId,
          userId,
          session,
        });
      } else {
        clientId = client!._id;
      }

      // 3. Actualizar estado del lead a ganado (solo para leads)
      if (entityType === 'lead' && lead) {
        const statusUpdate = await LeadModel.updateOne(
          { _id: lead._id, tenantId: new Types.ObjectId(tenantId) },
          {
            $set: {
              status: 'won',
              updatedBy: userId,
            },
          },
          { session }
        );

        if (statusUpdate.modifiedCount === 0) {
          console.error('[ConfirmSale] Failed to update lead status to won:', {
            leadId: entityId,
            tenantId,
          });
        }
      }

      // 3b. Actualizar estado de Gestion del cliente a ganado (solo para clientes)
      if (entityType === 'client' && clientId) {
        const gestionUpdate = await GestionModel.findOneAndUpdate(
          { 
            clientId: new Types.ObjectId(clientId),
            tenantId: new Types.ObjectId(tenantId),
            status: { $nin: ['won', 'lost'] }
          },
          {
            $set: {
              status: 'won',
              updatedAt: new Date(),
            },
          },
          { session }
        );
        console.log('[ConfirmSale] Gestion updated to won:', gestionUpdate ? { _id: gestionUpdate._id, status: gestionUpdate.status } : 'NOT FOUND');

        // Also update client's operationStatus
        await ClientModel.updateOne(
          { _id: new Types.ObjectId(clientId) },
          { $set: { operationStatus: 'sale_confirmed', operationStatusUpdatedAt: new Date() } },
          { session }
        );
      }

      // 4. Crear la orden de trabajo (draft) para la venta confirmada
      const workOrder = await SaleConfirmationService.createWorkOrder({
        entityType,
        lead,
        client,
        saleMode,
        quotes,
        resolvedCustomerType,
        notes,
        totalAmount,
        clientId,
        tenantId,
        userId,
        session,
      });

      // Link work order to the lead
      if (entityType === 'lead' && lead) {
        await LeadModel.updateOne(
          { _id: lead._id, tenantId: new Types.ObjectId(tenantId) },
          { $set: { convertedToWorkOrder: workOrder._id } },
          { session }
        );
      }

      // Link quotes to the work order so hasWorkOrder resolves correctly
      if (saleMode === 'quotes' && quoteIds) {
        await QuoteModel.updateMany(
          { _id: { $in: quoteIds.map((id) => new Types.ObjectId(id)) } },
          { $set: { convertedToWorkOrder: workOrder._id } },
          { session }
        );
      }

      // 5. Para venta directa: crear Quote + QuoteVersion
      let directSaleQuoteId: Types.ObjectId | null = null;
      if (saleMode === 'direct' && directSale) {
        directSaleQuoteId = await SaleConfirmationService.createDirectSaleQuote({
          entityType,
          lead,
          client,
          clientId,
          directSale,
          notes,
          workOrder,
          tenantId,
          userId,
          session,
        });
      }

      await session.commitTransaction();
      session.endSession();

      // Reasignar presupuestos / registrar actividad comercial
      if (saleMode === 'quotes' && quoteIds && clientId) {
        await CommercialProcessService.onConfirmSale(
          entityType,
          entityId,
          quoteIds,
          clientId.toString(),
          tenantId,
          userId,
          totalAmount,
          'quotes',
        );
      } else if (saleMode === 'direct' && clientId && directSale) {
        await CommercialProcessService.onConfirmSale(
          entityType,
          entityId,
          [],
          clientId.toString(),
          tenantId,
          userId,
          totalAmount,
          'direct',
        );
      }

      // Publish WORK_ORDER_CREATED event for timeline/audit
      try {
        await eventBus.publish({
          type: DOMAIN_EVENTS.WORK_ORDER_CREATED,
          aggregateId: workOrder._id.toString(),
          aggregateType: 'WorkOrder',
          tenantId,
          userId,
          timestamp: new Date(),
          payload: {
            workOrderId: workOrder._id.toString(),
            leadId: entityType === 'lead' ? entityId : null,
            number: workOrder.workOrderNumber,
            clientId: clientId.toString(),
            title: workOrder.title,
            category: workOrder.category,
            priority: workOrder.priority,
            scheduledDate: workOrder.scheduledDate,
            clientName: SaleConfirmationService.entityName(entityType, lead, client),
            address: undefined,
          } as WorkOrderCreatedPayload,
        });
      } catch (eventError) {
        console.error('[ConfirmSale] Failed to publish WORK_ORDER_CREATED:', eventError);
      }

      // Publish SALE_CONFIRMED event
      try {
        await eventBus.publish({
          type: DOMAIN_EVENTS.SALE_CONFIRMED,
          aggregateId: entityId,
          aggregateType: entityType === 'lead' ? 'Lead' : 'Client',
          tenantId,
          userId,
          timestamp: new Date(),
          payload: {
            leadId: entityType === 'lead' ? entityId : null,
            clientId: clientId.toString(),
            amount: totalAmount,
            saleMode,
            leadName:
              entityType === 'lead'
                ? lead!.name
                : SaleConfirmationService.entityName(entityType, lead, client),
            quotesCount: saleMode === 'quotes' ? quoteIds?.length || 0 : undefined,
          } as SaleConfirmedPayload,
        });
      } catch (eventError) {
        console.error('[confirm-sale] Failed to publish SALE_CONFIRMED:', eventError);
      }

      return {
        success: true,
        clientId: clientId.toString(),
        workOrderId: workOrder?._id.toString() || null,
        workOrderNumber: workOrder?.workOrderNumber || null,
        totalAmount,
        quotesApproved,
        saleMode,
        quoteId: directSaleQuoteId?.toString() || null,
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  private static entityName(
    entityType: 'lead' | 'client',
    lead: ILead | null,
    client: IClient | null,
  ): string {
    if (entityType === 'lead' && lead) {
      return lead.companyName || lead.name;
    }
    if (client) {
      return client.companyName || client.fullName || '—';
    }
    return '';
  }

  private static async getOrCreateClientFromLead(args: {
    lead: ILead;
    saleMode: 'quotes' | 'direct';
    quotes: SaleQuote[];
    directSale?: SaleConfirmationParams['directSale'];
    notes?: string;
    resolvedCustomerType: string;
    totalAmount: number;
    tenantId: string;
    userId: string;
    session: ClientSession;
  }): Promise<Types.ObjectId> {
    const {
      lead,
      saleMode,
      quotes,
      directSale,
      notes,
      resolvedCustomerType,
      totalAmount,
      tenantId,
      userId,
      session,
    } = args;

    let clientId = lead.convertedToClient;

    if (!clientId) {
      let clientNotes = '';
      if (saleMode === 'quotes' && quotes.length > 0) {
        clientNotes = `Cliente creado desde Lead #${lead._id}\nVenta confirmada por $${totalAmount.toLocaleString()}\n${quotes.length} presupuesto(s) aprobado(s)`;
      } else if (saleMode === 'direct' && directSale) {
        clientNotes = `Cliente creado desde Lead #${lead._id}\nVenta directa confirmada por $${totalAmount.toLocaleString()}`;
        if (directSale.description) {
          clientNotes += `\nDescripción: ${directSale.description}`;
        }
      }
      if (notes) {
        clientNotes += `\nNotas: ${notes}`;
      }

      const [client] = await ClientModel.create(
        [
          {
            tenantId: new Types.ObjectId(tenantId),
            customerType: resolvedCustomerType,
            fullName: lead.name,
            companyName: lead.companyName,
            profileName: (lead as any).profileName || lead.companyName,
            email: lead.email,
            phone: lead.phone,
            status: 'active',
            source: lead.source,
            address: lead.address || undefined,
            locality: lead.locality || undefined,
            province: lead.province || undefined,
            notes: clientNotes,
            createdBy: new Types.ObjectId(userId),
            updatedBy: new Types.ObjectId(userId),
          },
        ],
        { session }
      );
      clientId = client._id;

      // Crear contacto primario desde el lead
      const nameParts = lead.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || firstName;

      await ContactModel.create([{
        tenantId: new Types.ObjectId(tenantId),
        clientId: clientId,
        firstName,
        lastName,
        email: lead.email || undefined,
        phone: lead.phone || undefined,
        isPrimary: true,
        createdBy: new Types.ObjectId(userId),
        updatedBy: new Types.ObjectId(userId),
      }], { session });

      const leadUpdate = await LeadModel.updateOne(
        { _id: lead._id, tenantId: new Types.ObjectId(tenantId) },
        {
          $set: {
            convertedToClient: clientId,
            convertedAt: new Date(),
            updatedBy: userId,
          },
        },
        { session }
      );

      if (leadUpdate.modifiedCount === 0) {
        console.error('[ConfirmSale] Failed to update lead with client reference:', {
          leadId: lead._id.toString(),
          clientId,
        });
      }

      // Migrar conversación de lead a cliente
      console.log('[ConfirmSale] Migrando conversación - leadId:', lead._id, 'clientId:', clientId);
      const convResult = await ConversationModel.updateMany(
        {
          leadId: lead._id,
          conversationType: 'lead',
        },
        {
          $set: {
            clientId: clientId,
            conversationType: 'customer',
            lifecycleState: 'ACTIVE_CLIENT',
            state: 'idle', // Reabrir conversación para cliente
            closedAt: null,
            'engineData.isCustomer': true,
            'engineData.clientId': String(clientId),
          },
        },
        { session }
      );
      console.log('[ConfirmSale] Conversaciones migradas:', convResult.modifiedCount);

      // También agregar phoneNumber a la conversación (si no existe) para poder buscar por teléfono
      if (lead.phone) {
        const phoneNumberUpdate = await ConversationModel.updateMany(
          {
            leadId: lead._id,
            phoneNumber: { $exists: false },
          },
          {
            $set: {
              phoneNumber: lead.phone,
            },
          },
          { session }
        );
        console.log('[ConfirmSale] phoneNumber agregado a conversaciones:', phoneNumberUpdate.modifiedCount);
      }

      // Migrar mensajes de WhatsApp del lead al cliente
      console.log('[ConfirmSale] Migrando mensajes - leadId:', lead._id, 'clientId:', clientId);
      const msgResult = await WhatsAppMessageModel.updateMany(
        {
          leadId: lead._id,
        },
        {
          $set: {
            clientId: clientId,
          },
        },
        { session }
      );
      console.log('[ConfirmSale] Mensajes migrados:', msgResult.modifiedCount);
    }

    return clientId;
  }

  private static async createWorkOrder(args: {
    entityType: 'lead' | 'client';
    lead: ILead | null;
    client: IClient | null;
    saleMode: 'quotes' | 'direct';
    quotes: SaleQuote[];
    resolvedCustomerType: string;
    notes?: string;
    totalAmount: number;
    clientId: Types.ObjectId;
    tenantId: string;
    userId: string;
    session: ClientSession;
  }): Promise<InstanceType<typeof WorkOrderModel>> {
    const {
      entityType,
      lead,
      client,
      saleMode,
      quotes,
      resolvedCustomerType,
      notes,
      clientId,
      tenantId,
      userId,
      session,
    } = args;

    const workOrderNumber = await getNextWorkOrderNumber(tenantId);

    // Get first quote for location/quoteId reference
    let firstQuoteId: Types.ObjectId | null = null;
    let locationId: Types.ObjectId | null = null;
    let locationSnapshot: { name?: string; address?: string } = {};

    if (saleMode === 'quotes' && quotes.length > 0) {
      const firstQuote = quotes[0];
      firstQuoteId = firstQuote._id;

      // Try to get location from quote if available
      if (firstQuote.locationId) {
        locationId = firstQuote.locationId;
        const LocationModel = (await import('@/crm/models/location')).default;
        const location = await LocationModel.findById(locationId).lean();
        if (location) {
          locationSnapshot = {
            name: location.name,
            address: location.address,
          };
        }
      }
    }

    const name = SaleConfirmationService.entityName(entityType, lead, client);

    const workOrderData = {
      tenantId: new Types.ObjectId(tenantId),
      clientId,
      leadId: entityType === 'lead' ? lead!._id : null,
      quoteId: firstQuoteId,
      locationId: locationId || null,
      clientSnapshot: {
        name,
        email: entityType === 'lead' ? lead!.email : client!.email,
        phone: entityType === 'lead' ? lead!.phone : client!.phone,
        companyName: entityType === 'lead' ? lead!.companyName || '' : client!.companyName || '',
        customerType: resolvedCustomerType,
        status: 'active',
      },
      locationSnapshot:
        Object.keys(locationSnapshot).length > 0
          ? locationSnapshot
          : saleMode === 'quotes'
            ? {}
            : {
                name,
                address: '',
              },
      source: 'manual', // TODO: change to 'lead_conversion' or 'direct_sale' after server restart
      workOrderNumber,
      title: `Venta: ${name}`,
      description:
        notes ||
        (entityType === 'lead'
          ? `Venta generada desde lead #${lead!._id}`
          : 'Venta generada desde cliente'),
      priority: 'normal',
      category: 'installation',
      status: 'draft',
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    };

    const [workOrder] = await WorkOrderModel.create([workOrderData], { session });

    return workOrder;
  }

  private static async createDirectSaleQuote(args: {
    entityType: 'lead' | 'client';
    lead: ILead | null;
    client: IClient | null;
    clientId: Types.ObjectId;
    directSale: NonNullable<SaleConfirmationParams['directSale']>;
    notes?: string;
    workOrder: InstanceType<typeof WorkOrderModel>;
    tenantId: string;
    userId: string;
    session: ClientSession;
  }): Promise<Types.ObjectId> {
    const {
      entityType,
      lead,
      client,
      clientId,
      directSale,
      notes,
      workOrder,
      tenantId,
      userId,
      session,
    } = args;

    const quoteNumber = await getNextQuoteNumber(tenantId);
    const items = directSale.items || [];
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const name =
      entityType === 'lead'
        ? lead!.name
        : SaleConfirmationService.entityName(entityType, lead, client);

    const [directQuote] = await QuoteModel.create(
      [
        {
          tenantId: new Types.ObjectId(tenantId),
          leadId: entityType === 'lead' ? lead!._id : null,
          clientId,
          number: quoteNumber,
          status: 'direct_sale',
          currentVersion: 1,
          title: directSale.description || `Venta directa - ${name}`,
          description: directSale.description,
          validUntil: null,
          subtotal,
          discountAmount: 0,
          taxAmount: 0,
          total: directSale.amount,
          notes,
          approvedAt: new Date(),
          convertedToWorkOrder: workOrder._id,
          convertedAt: new Date(),
          createdBy: new Types.ObjectId(userId),
          updatedBy: new Types.ObjectId(userId),
        },
      ],
      { session }
    );

    await QuoteVersionModel.create(
      [
        {
          tenantId: new Types.ObjectId(tenantId),
          quoteId: directQuote._id,
          version: 1,
          title: directQuote.title,
          description: directSale.description,
          items: items.map((item) => ({
            description: item.description,
            type: item.type,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.quantity * item.unitPrice,
          })),
          subtotal,
          discountAmount: 0,
          taxAmount: 0,
          total: directSale.amount,
          notes,
          createdBy: new Types.ObjectId(userId),
        },
      ],
      { session }
    );

    // Link work order back to this quote
    await WorkOrderModel.updateOne(
      { _id: workOrder._id, tenantId: new Types.ObjectId(tenantId) },
      { $set: { quoteId: directQuote._id } },
      { session }
    );

    return directQuote._id;
  }
}
