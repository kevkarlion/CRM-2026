import { EventHandler, eventBus } from '@/infrastructure/events/event-bus';
import {
  DomainEvent,
  ClientCreatedPayload,
  ClientStatusChangedPayload,
  SaleConfirmedPayload,
  QuoteCreatedPayload,
  QuoteSentPayload,
  QuoteApprovedPayload,
  VisitCreatedPayload,
  VisitCompletedPayload,
  WorkOrderCreatedPayload,
  WorkOrderCompletedPayload,
} from '@/infrastructure/events/event.types';
import { timelineService } from '../services/timeline.service';
import { label } from './timeline.handler';
import TimelineEventModel from '../models/timeline-event';

function quoteSummary(number: string, total: number): string {
  return `${number} — $${total.toLocaleString('es-AR')}`;
}

/**
 * Verifica si ya existe un evento similar para evitar duplicados
 */
async function eventExists(
  tenantId: string,
  leadId: string,
  eventType: string,
  entityType: string
): Promise<boolean> {
  const existing = await TimelineEventModel.findOne({
    tenantId: new (require('mongoose').Types.ObjectId)(tenantId),
    leadId: new (require('mongoose').Types.ObjectId)(leadId),
    eventType,
    entityType,
  }).lean();
  return !!existing;
}

function visitSummary(p: { category?: string; priority?: string }): string | undefined {
  const categoryLabel = label(p.category);
  const priorityLabel = label(p.priority);
  return [
    categoryLabel,
    priorityLabel ? `Prioridad: ${priorityLabel}` : null,
  ].filter(Boolean).join(' · ') || undefined;
}

export const clientActivityOrchestrator = {
  register(): void {
    const on = (type: string, handler: EventHandler) => eventBus.on(type, handler);

    on('CLIENT_CREATED', clientActivityOrchestrator.onClientCreated as EventHandler);
    on('CLIENT_STATUS_CHANGED', clientActivityOrchestrator.onClientStatusChanged as EventHandler);
    on('SALE_CONFIRMED', clientActivityOrchestrator.onSaleConfirmed as EventHandler);

    on('QUOTE_CREATED', clientActivityOrchestrator.onQuoteCreated as EventHandler);
    on('QUOTE_SENT', clientActivityOrchestrator.onQuoteSent as EventHandler);
    on('QUOTE_APPROVED', clientActivityOrchestrator.onQuoteApproved as EventHandler);

    on('VISIT_CREATED', clientActivityOrchestrator.onVisitCreated as EventHandler);
    on('VISIT_COMPLETED', clientActivityOrchestrator.onVisitCompleted as EventHandler);

    on('WORK_ORDER_CREATED', clientActivityOrchestrator.onWorkOrderCreated as EventHandler);
    on('WORK_ORDER_COMPLETED', clientActivityOrchestrator.onWorkOrderCompleted as EventHandler);
  },

  // ─── Client ───────────────────────────────────────────

  async onClientCreated(event: DomainEvent<ClientCreatedPayload>): Promise<void> {
    const p = event.payload;
    if (!p.clientId) return;
    await timelineService.create({
      tenantId: event.tenantId,
      clientId: p.clientId,
      entityType: 'client',
      entityId: p.clientId,
      eventType: 'client.created',
      title: `Cliente "${p.name}" creado`,
      icon: 'user-plus',
      color: 'blue',
      performedBy: event.userId,
      metadata: {
        name: p.name,
        customerType: p.customerType,
        email: p.email,
        phone: p.phone,
        source: p.source,
      },
    });
  },

  async onClientStatusChanged(event: DomainEvent<ClientStatusChangedPayload>): Promise<void> {
    const p = event.payload;
    if (!p.clientId) return;
    const blocked = p.to === 'blocked';
    await timelineService.create({
      tenantId: event.tenantId,
      clientId: p.clientId,
      entityType: 'client',
      entityId: p.clientId,
      eventType: 'client.status_changed',
      title: blocked ? 'Cliente bloqueado' : 'Cliente desbloqueado',
      icon: blocked ? 'ban' : 'check-circle',
      color: blocked ? 'red' : 'green',
      performedBy: event.userId,
      metadata: {
        from: p.from,
        to: p.to,
        reason: p.reason,
        name: p.name,
      },
    });
  },

  // ─── Sale (client-scoped only; the lead case stays in timelineHandler) ───

  async onSaleConfirmed(event: DomainEvent<SaleConfirmedPayload>): Promise<void> {
    const p = event.payload;
    // Only create for clients without leadId - timeline handler creates for leads
    if (p.leadId || !p.clientId) return;
    
    // Determine sale type label
    let saleTypeLabel = '';
    if (p.saleMode === 'product') {
      saleTypeLabel = 'por producto';
    } else if (p.saleMode === 'direct') {
      saleTypeLabel = 'por servicio';
    } else {
      saleTypeLabel = p.saleMode === 'quotes' ? 'mediante presupuestos' : 'venta directa';
    }
    
    const documentInfo = p.documentTitle ? ` — "${p.documentTitle}"` : '';
    const date = new Date(event.timestamp);
    date.setHours(date.getHours() - 3); // Adjust from UTC to Argentina timezone
    const formattedDate = date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    await timelineService.create({
      tenantId: event.tenantId,
      clientId: p.clientId,
      entityType: 'client',
      entityId: p.clientId,
      eventType: 'client.sale_confirmed',
      title: `Venta confirmada ${saleTypeLabel} — ${formattedDate}`,
      summary: `$${p.amount.toLocaleString('es-AR')}${p.quotesCount ? ` (${p.quotesCount} presupuesto${p.quotesCount > 1 ? 's' : ''})` : ''}${documentInfo}`,
      icon: 'check-circle',
      color: 'green',
      performedBy: event.userId,
      metadata: {
        amount: p.amount,
        saleMode: p.saleMode,
        clientId: p.clientId,
        leadName: p.leadName,
        quotesCount: p.quotesCount,
        documentId: p.documentId,
        documentTitle: p.documentTitle,
      },
    });
  },

  // ─── Quote ────────────────────────────────────────────

  async onQuoteCreated(event: DomainEvent<QuoteCreatedPayload>): Promise<void> {
    const p = event.payload;
    if (!p.clientId) return;
    
    // Skip if lead already has this event (timeline handler creates it)
    if (p.leadId && await eventExists(event.tenantId, p.leadId, 'quote.created', 'quote')) {
      return;
    }
    
    // Only create for client quotes (no leadId)
    if (p.leadId) return;
    
    await timelineService.create({
      tenantId: event.tenantId,
      clientId: p.clientId,
      entityType: 'client',
      entityId: p.clientId,
      eventType: 'quote.created',
      title: p.title || 'Presupuesto creado',
      summary: quoteSummary(p.number, p.total),
      icon: 'file-text',
      color: 'blue',
      performedBy: event.userId,
      metadata: {
        number: p.number,
        total: p.total,
        status: p.status,
        statusLabel: label(p.status),
        validUntil: p.validUntil,
        title: p.title,
        sourceType: 'quote',
        sourceId: p.quoteId,
      },
    });
  },

  async onQuoteSent(event: DomainEvent<QuoteSentPayload>): Promise<void> {
    const p = event.payload;
    if (!p.clientId) return;
    
    // Skip if lead already has this event (timeline handler creates it)
    if (p.leadId && await eventExists(event.tenantId, p.leadId, 'quote.sent', 'quote')) {
      return;
    }
    
    // Only create for client quotes (no leadId)
    if (p.leadId) return;
    
    await timelineService.create({
      tenantId: event.tenantId,
      clientId: p.clientId,
      entityType: 'client',
      entityId: p.clientId,
      eventType: 'quote.sent',
      title: p.title || 'Presupuesto enviado',
      summary: quoteSummary(p.number, p.total),
      icon: 'send',
      color: 'indigo',
      performedBy: event.userId,
      metadata: {
        number: p.number,
        total: p.total,
        status: p.status || 'sent',
        statusLabel: label(p.status || 'sent'),
        validUntil: p.validUntil,
        title: p.title,
        sourceType: 'quote',
        sourceId: p.quoteId,
      },
    });
  },

  async onQuoteApproved(event: DomainEvent<QuoteApprovedPayload>): Promise<void> {
    const p = event.payload;
    if (!p.clientId) return;
    
    // Skip if lead already has this event (timeline handler creates it)
    if (p.leadId && await eventExists(event.tenantId, p.leadId, 'quote.approved', 'quote')) {
      return;
    }
    
    // Only create for client quotes (no leadId)
    if (p.leadId) return;
    await timelineService.create({
      tenantId: event.tenantId,
      clientId: p.clientId,
      entityType: 'client',
      entityId: p.clientId,
      eventType: 'quote.approved',
      title: 'Presupuesto aprobado',
      summary: p.number ? quoteSummary(p.number, p.total || 0) : undefined,
      icon: 'check',
      color: 'green',
      performedBy: event.userId,
      metadata: {
        number: p.number,
        total: p.total,
        title: p.title,
        status: 'approved',
        statusLabel: 'Aprobado',
        sourceType: 'quote',
        sourceId: p.quoteId,
      },
    });
  },

  // ─── Visit ────────────────────────────────────────────

  async onVisitCreated(event: DomainEvent<VisitCreatedPayload>): Promise<void> {
    const p = event.payload;
    if (!p.clientId) return;
    await timelineService.create({
      tenantId: event.tenantId,
      clientId: p.clientId,
      entityType: 'client',
      entityId: p.clientId,
      eventType: 'visit.created',
      title: p.title || `Visita técnica #${p.number} creada`,
      summary: visitSummary(p),
      icon: 'map-pin',
      color: 'teal',
      performedBy: event.userId,
      metadata: {
        number: p.number,
        title: p.title,
        scheduledDate: p.scheduledDate,
        scheduledTime: p.scheduledTime,
        category: p.category,
        categoryLabel: label(p.category),
        priority: p.priority,
        priorityLabel: label(p.priority),
        address: p.address,
        sourceType: 'visit',
        sourceId: p.visitId,
      },
    });
  },

  async onVisitCompleted(event: DomainEvent<VisitCompletedPayload>): Promise<void> {
    const p = event.payload;
    if (!p.clientId) return;
    await timelineService.create({
      tenantId: event.tenantId,
      clientId: p.clientId,
      entityType: 'client',
      entityId: p.clientId,
      eventType: 'visit.completed',
      title: `Visita ${p.number || ''} completada`,
      icon: 'check-circle',
      color: 'green',
      performedBy: event.userId,
      metadata: {
        number: p.number,
        status: 'completed',
        statusLabel: 'Completada',
        sourceType: 'visit',
        sourceId: p.visitId,
      },
    });
  },

  // ─── Work Order ───────────────────────────────────────

  async onWorkOrderCreated(event: DomainEvent<WorkOrderCreatedPayload>): Promise<void> {
    const p = event.payload;
    if (!p.clientId) return;
    await timelineService.create({
      tenantId: event.tenantId,
      clientId: p.clientId,
      entityType: 'client',
      entityId: p.clientId,
      eventType: 'workorder.created',
      title: p.title || `Orden de trabajo #${p.number} creada`,
      summary: visitSummary(p),
      icon: 'clipboard-list',
      color: 'orange',
      performedBy: event.userId,
      metadata: {
        number: p.number,
        title: p.title,
        category: p.category,
        categoryLabel: label(p.category),
        priority: p.priority,
        priorityLabel: label(p.priority),
        scheduledDate: p.scheduledDate,
        clientName: p.clientName,
        address: p.address,
        sourceType: 'work_order',
        sourceId: p.workOrderId,
      },
    });
  },

  async onWorkOrderCompleted(event: DomainEvent<WorkOrderCompletedPayload>): Promise<void> {
    const p = event.payload;
    if (!p.clientId) return;
    await timelineService.create({
      tenantId: event.tenantId,
      clientId: p.clientId,
      entityType: 'client',
      entityId: p.clientId,
      eventType: 'workorder.completed',
      title: `OT ${p.number || ''} completada`,
      icon: 'check-circle',
      color: 'green',
      performedBy: event.userId,
      metadata: {
        number: p.number,
        status: 'completed',
        statusLabel: 'Completado',
        sourceType: 'work_order',
        sourceId: p.workOrderId,
      },
    });
  },
};
