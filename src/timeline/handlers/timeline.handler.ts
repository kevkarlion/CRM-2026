import { EventHandler, eventBus } from '@/infrastructure/events/event-bus';
import {
  DomainEvent,
  LeadCreatedPayload,
  LeadStatusChangedPayload,
  LeadConvertedPayload,
  QuoteCreatedPayload,
  QuoteSentPayload,
  QuoteApprovedPayload,
  QuoteRejectedPayload,
  QuoteConvertedPayload,
  NegotiationOpenedPayload,
  NegotiationAcceptedPayload,
  NegotiationRejectedPayload,
  WorkOrderCreatedPayload,
  WorkOrderStatusChangedPayload,
  WorkOrderCompletedPayload,
  WorkOrderSelfAssignedPayload,
  VisitCreatedPayload,
  VisitStatusChangedPayload,
  VisitCompletedPayload,
  SaleConfirmedPayload,
} from '@/infrastructure/events/event.types';
import { timelineService } from '../services/timeline.service';

const STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo', contacted: 'Contactado', quote_sent: 'Presupuesto enviado',
  technical_visit: 'Visita técnica', negotiation: 'Negociación', qualified: 'Calificado',
  won: 'Ganado', lost: 'Perdido', disqualified: 'Descalificado',
  draft: 'Borrador', sent: 'Enviado', approved: 'Aprobado', rejected: 'Rechazado',
  expired: 'Expirado', cancelled: 'Cancelado',
  scheduled: 'Programado', confirmed: 'Confirmado', assigned: 'Asignado',
  en_route: 'En ruta', on_site: 'En sitio', paused: 'Pausado',
  completed: 'Completado', closed: 'Cerrado',
  installation: 'Instalación', maintenance: 'Mantenimiento', repair: 'Reparación',
  inspection: 'Inspección', warranty: 'Garantía', emergency: 'Emergencia',
  low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente',
};

function label(key?: string): string | undefined {
  return key ? (STATUS_LABELS[key] || key) : undefined;
}

export const timelineHandler = {
  register(): void {
    const on = (type: string, handler: EventHandler) => eventBus.on(type, handler);

    on('LEAD_CREATED', timelineHandler.onLeadCreated as EventHandler);
    on('LEAD_STATUS_CHANGED', timelineHandler.onLeadStatusChanged as EventHandler);
    on('LEAD_CONVERTED', timelineHandler.onLeadConverted as EventHandler);

    on('QUOTE_CREATED', timelineHandler.onQuoteCreated as EventHandler);
    on('QUOTE_SENT', timelineHandler.onQuoteSent as EventHandler);
    on('QUOTE_APPROVED', timelineHandler.onQuoteApproved as EventHandler);
    on('QUOTE_REJECTED', timelineHandler.onQuoteRejected as EventHandler);
    on('QUOTE_CONVERTED', timelineHandler.onQuoteConverted as EventHandler);

    on('NEGOTIATION_OPENED', timelineHandler.onNegotiationOpened as EventHandler);
    on('NEGOTIATION_ACCEPTED', timelineHandler.onNegotiationAccepted as EventHandler);
    on('NEGOTIATION_REJECTED', timelineHandler.onNegotiationRejected as EventHandler);

    on('WORK_ORDER_CREATED', timelineHandler.onWorkOrderCreated as EventHandler);
    on('WORK_ORDER_STATUS_CHANGED', timelineHandler.onWorkOrderStatusChanged as EventHandler);
    on('WORK_ORDER_COMPLETED', timelineHandler.onWorkOrderCompleted as EventHandler);
    on('WORK_ORDER_SELF_ASSIGNED', timelineHandler.onWorkOrderSelfAssigned as EventHandler);
    on('VISIT_CREATED', timelineHandler.onVisitCreated as EventHandler);
    on('VISIT_STATUS_CHANGED', timelineHandler.onVisitStatusChanged as EventHandler);
    on('VISIT_COMPLETED', timelineHandler.onVisitCompleted as EventHandler);

    on('SALE_CONFIRMED', timelineHandler.onSaleConfirmed as EventHandler);
  },

  // ─── Lead ──────────────────────────────────────────────

  async onLeadCreated(event: DomainEvent<LeadCreatedPayload>): Promise<void> {
    const p = event.payload;
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: p.leadId,
      entityType: 'lead',
      entityId: p.leadId,
      eventType: 'lead.created',
      title: `Lead "${p.name}" creado`,
      summary: `Fuente: ${p.source}`,
      icon: 'user-plus',
      color: 'blue',
      performedBy: event.userId,
      metadata: {
        name: p.name,
        source: p.source,
        email: p.email,
        phone: p.phone,
        companyName: p.companyName,
      },
    });
  },

  async onLeadStatusChanged(event: DomainEvent<LeadStatusChangedPayload>): Promise<void> {
    const { from, to } = event.payload;
    const fromLabel = label(from) || from;
    const toLabel = label(to) || to;
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: event.payload.leadId,
      entityType: 'lead',
      entityId: event.payload.leadId,
      eventType: 'lead.status_changed',
      title: `Estado: ${fromLabel} → ${toLabel}`,
      icon: 'arrow-right',
      color: 'gray',
      performedBy: event.userId,
      metadata: {
        from,
        to,
        fromLabel,
        toLabel,
        leadName: event.payload.leadName,
      },
    });
  },

  async onLeadConverted(event: DomainEvent<LeadConvertedPayload>): Promise<void> {
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: event.payload.leadId,
      entityType: 'lead',
      entityId: event.payload.leadId,
      eventType: 'lead.converted',
      title: 'Convertido a cliente',
      summary: event.payload.clientName
        ? `Cliente: ${event.payload.clientName}`
        : `Cliente ID: ${event.payload.clientId}`,
      icon: 'check-circle',
      color: 'green',
      performedBy: event.userId,
      metadata: {
        clientId: event.payload.clientId,
        leadName: event.payload.leadName,
        clientName: event.payload.clientName,
      },
    });
  },

  // ─── Quote ─────────────────────────────────────────────

  async onQuoteCreated(event: DomainEvent<QuoteCreatedPayload>): Promise<void> {
    const p = event.payload;
    const statusLabel = label(p.status) || p.status;
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: p.leadId || '',
      entityType: 'quote',
      entityId: p.quoteId,
      eventType: 'quote.created',
      title: p.title || 'Presupuesto creado',
      summary: `${p.number} — $${p.total.toLocaleString('es-AR')}`,
      icon: 'file-text',
      color: 'blue',
      performedBy: event.userId,
      metadata: {
        number: p.number,
        total: p.total,
        status: p.status,
        statusLabel,
        validUntil: p.validUntil,
        title: p.title,
        description: p.description,
        notes: p.notes,
      },
    });
  },

  async onQuoteSent(event: DomainEvent<QuoteSentPayload>): Promise<void> {
    const p = event.payload;
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: p.leadId,
      entityType: 'quote',
      entityId: p.quoteId,
      eventType: 'quote.sent',
      title: p.title || 'Presupuesto enviado',
      summary: `${p.number} — $${p.total.toLocaleString('es-AR')}`,
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
      },
    });
  },

  async onQuoteApproved(event: DomainEvent<QuoteApprovedPayload>): Promise<void> {
    const p = event.payload;
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: p.leadId ?? '',
      entityType: 'quote',
      entityId: p.quoteId,
      eventType: 'quote.approved',
      title: 'Presupuesto aprobado',
      summary: p.number
        ? `${p.number} — $${(p.total || 0).toLocaleString('es-AR')}`
        : undefined,
      icon: 'check',
      color: 'green',
      performedBy: event.userId,
      metadata: {
        number: p.number,
        total: p.total,
        title: p.title,
        status: 'approved',
        statusLabel: 'Aprobado',
      },
    });
  },

  async onQuoteRejected(event: DomainEvent<QuoteRejectedPayload>): Promise<void> {
    const p = event.payload;
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: p.leadId ?? '',
      entityType: 'quote',
      entityId: p.quoteId,
      eventType: 'quote.rejected',
      title: 'Presupuesto rechazado',
      summary: p.number
        ? `${p.number} — $${(p.total || 0).toLocaleString('es-AR')}`
        : undefined,
      icon: 'x',
      color: 'red',
      performedBy: event.userId,
      metadata: {
        number: p.number,
        total: p.total,
        title: p.title,
        reason: p.reason,
        status: 'rejected',
        statusLabel: 'Rechazado',
      },
    });
  },

  async onQuoteConverted(event: DomainEvent<QuoteConvertedPayload>): Promise<void> {
    const p = event.payload;
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: '',
      entityType: 'quote',
      entityId: p.quoteId,
      eventType: 'quote.converted',
      title: `Convertido a OT #${p.workOrderNumber}`,
      summary: p.total ? `$${p.total.toLocaleString('es-AR')}` : undefined,
      icon: 'arrow-right',
      color: 'green',
      performedBy: event.userId,
      metadata: {
        workOrderId: p.workOrderId,
        workOrderNumber: p.workOrderNumber,
        total: p.total,
      },
    });
  },

  // ─── Negotiation ───────────────────────────────────────

  async onNegotiationOpened(event: DomainEvent<NegotiationOpenedPayload>): Promise<void> {
    const p = event.payload;
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: p.leadId,
      entityType: 'negotiation',
      entityId: p.negotiationId,
      eventType: 'negotiation.opened',
      title: 'Negociación iniciada',
      summary: p.initialAmount
        ? `Monto inicial: $${p.initialAmount.toLocaleString('es-AR')}`
        : undefined,
      icon: 'handshake',
      color: 'purple',
      performedBy: event.userId,
      metadata: {
        leadName: p.leadName,
        initialAmount: p.initialAmount,
      },
    });
  },

  async onNegotiationAccepted(event: DomainEvent<NegotiationAcceptedPayload>): Promise<void> {
    const p = event.payload;
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: p.leadId,
      entityType: 'negotiation',
      entityId: p.negotiationId,
      eventType: 'negotiation.accepted',
      title: 'Negociación aceptada',
      summary: p.finalAmount
        ? `Monto final: $${p.finalAmount.toLocaleString('es-AR')}`
        : undefined,
      icon: 'check-circle',
      color: 'green',
      performedBy: event.userId,
      metadata: {
        finalAmount: p.finalAmount,
      },
    });
  },

  async onNegotiationRejected(event: DomainEvent<NegotiationRejectedPayload>): Promise<void> {
    const p = event.payload;
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: p.leadId,
      entityType: 'negotiation',
      entityId: p.negotiationId,
      eventType: 'negotiation.rejected',
      title: 'Negociación rechazada',
      summary: p.reason || undefined,
      icon: 'x-circle',
      color: 'red',
      performedBy: event.userId,
      metadata: {
        reason: p.reason,
      },
    });
  },

  // ─── Work Order ────────────────────────────────────────

  async onWorkOrderCreated(event: DomainEvent<WorkOrderCreatedPayload>): Promise<void> {
    const p = event.payload;
    const categoryLabel = label(p.category);
    const priorityLabel = label(p.priority);
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: p.leadId ?? '',
      entityType: 'work_order',
      entityId: p.workOrderId,
      eventType: 'workorder.created',
      title: p.title || `Orden de trabajo #${p.number} creada`,
      summary: [
        categoryLabel,
        priorityLabel ? `Prioridad: ${priorityLabel}` : null,
      ].filter(Boolean).join(' · ') || undefined,
      icon: 'clipboard-list',
      color: 'orange',
      performedBy: event.userId,
      metadata: {
        number: p.number,
        title: p.title,
        category: p.category,
        categoryLabel,
        priority: p.priority,
        priorityLabel,
        scheduledDate: p.scheduledDate,
        clientName: p.clientName,
        address: p.address,
      },
    });
  },

  async onWorkOrderStatusChanged(event: DomainEvent<WorkOrderStatusChangedPayload>): Promise<void> {
    const { workOrderId, from, to } = event.payload;
    const fromLabel = label(from) || from;
    const toLabel = label(to) || to;
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: '',
      entityType: 'work_order',
      entityId: workOrderId,
      eventType: 'workorder.status_changed',
      title: `OT ${event.payload.number || ''}: ${fromLabel} → ${toLabel}`,
      summary: event.payload.title || undefined,
      icon: 'refresh-cw',
      color: 'gray',
      performedBy: event.userId,
      metadata: {
        from,
        to,
        fromLabel,
        toLabel,
        number: event.payload.number,
        title: event.payload.title,
        category: event.payload.category,
        categoryLabel: label(event.payload.category),
      },
    });
  },

  async onWorkOrderCompleted(event: DomainEvent<WorkOrderCompletedPayload>): Promise<void> {
    const p = event.payload;
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: '',
      entityType: 'work_order',
      entityId: p.workOrderId,
      eventType: 'workorder.completed',
      title: `OT ${p.number || ''} completada`,
      icon: 'check-circle',
      color: 'green',
      performedBy: event.userId,
      metadata: {
        number: p.number,
        status: 'completed',
        statusLabel: 'Completado',
      },
    });
  },

  async onWorkOrderSelfAssigned(event: DomainEvent<WorkOrderSelfAssignedPayload>): Promise<void> {
    const p = event.payload;
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: '',
      entityType: 'work_order',
      entityId: p.workOrderId,
      eventType: 'workorder.self_assigned',
      title: `${p.technicianName} se auto-asignó la OT #${p.workOrderNumber}`,
      summary: `Motivo: ${label(p.reason) || p.reason}`,
      icon: 'user-check',
      color: 'indigo',
      performedBy: event.userId,
      metadata: {
        workOrderId: p.workOrderId,
        technicianId: p.technicianId,
        technicianName: p.technicianName,
        workOrderNumber: p.workOrderNumber,
        reason: p.reason,
        reasonLabel: label(p.reason) || p.reason,
      },
    });
  },

  // ─── Visit ─────────────────────────────────────────────

  async onVisitCreated(event: DomainEvent<VisitCreatedPayload>): Promise<void> {
    const p = event.payload;
    const categoryLabel = label(p.category);
    const priorityLabel = label(p.priority);
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: p.leadId ?? '',
      entityType: 'visit',
      entityId: p.visitId,
      eventType: 'visit.created',
      title: p.title || `Visita técnica #${p.number} creada`,
      summary: [
        categoryLabel,
        priorityLabel ? `Prioridad: ${priorityLabel}` : null,
      ].filter(Boolean).join(' · ') || undefined,
      icon: 'map-pin',
      color: 'teal',
      performedBy: event.userId,
      metadata: {
        number: p.number,
        title: p.title,
        scheduledDate: p.scheduledDate,
        scheduledTime: p.scheduledTime,
        category: p.category,
        categoryLabel,
        priority: p.priority,
        priorityLabel,
        address: p.address,
      },
    });
  },

  async onVisitStatusChanged(event: DomainEvent<VisitStatusChangedPayload>): Promise<void> {
    const { visitId, from, to } = event.payload;
    const fromLabel = label(from) || from;
    const toLabel = label(to) || to;
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: '',
      entityType: 'visit',
      entityId: visitId,
      eventType: 'visit.status_changed',
      title: `Visita ${event.payload.number || ''}: ${fromLabel} → ${toLabel}`,
      summary: event.payload.title || undefined,
      icon: 'refresh-cw',
      color: 'gray',
      performedBy: event.userId,
      metadata: {
        from,
        to,
        fromLabel,
        toLabel,
        number: event.payload.number,
        title: event.payload.title,
      },
    });
  },

  async onVisitCompleted(event: DomainEvent<VisitCompletedPayload>): Promise<void> {
    const p = event.payload;
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: '',
      entityType: 'visit',
      entityId: p.visitId,
      eventType: 'visit.completed',
      title: `Visita ${p.number || ''} completada`,
      icon: 'check-circle',
      color: 'green',
      performedBy: event.userId,
      metadata: {
        number: p.number,
        status: 'completed',
        statusLabel: 'Completada',
      },
    });
  },

  // ─── Sale ──────────────────────────────────────────────

  async onSaleConfirmed(event: DomainEvent<SaleConfirmedPayload>): Promise<void> {
    const p = event.payload;
    const modeLabel = p.saleMode === 'quotes' ? 'mediante presupuestos' : 'venta directa';
    await timelineService.create({
      tenantId: event.tenantId,
      leadId: p.leadId,
      entityType: 'lead',
      entityId: p.leadId,
      eventType: 'lead.converted',
      title: 'Venta confirmada',
      summary: `$${p.amount.toLocaleString('es-AR')} — ${modeLabel}${p.quotesCount ? ` (${p.quotesCount} presupuesto${p.quotesCount > 1 ? 's' : ''})` : ''}`,
      icon: 'check-circle',
      color: 'green',
      performedBy: event.userId,
      metadata: {
        amount: p.amount,
        saleMode: p.saleMode,
        clientId: p.clientId,
        leadName: p.leadName,
        quotesCount: p.quotesCount,
      },
    });
  },
};
