import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainEvent } from '@/infrastructure/events/event.types';

vi.mock('@/timeline/services/timeline.service', () => ({
  timelineService: { create: vi.fn() },
}));

import { clientActivityOrchestrator } from '@/timeline/handlers/client-activity.handler';
import { timelineHandler } from '@/timeline/handlers/timeline.handler';
import { timelineService } from '@/timeline/services/timeline.service';
import { eventBus } from '@/infrastructure/events/event-bus';

const TENANT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const CLIENT_ID = 'dddddddddddddddddddddddd';
const SOURCE_ID = 'cccccccccccccccccccccccc';
const LEAD_ID = 'eeeeeeeeeeeeeeeeeeeeeeee';

function buildEvent(type: string, payload: Record<string, unknown>): DomainEvent<any> {
  return {
    type,
    aggregateId: SOURCE_ID,
    aggregateType: 'Entity',
    tenantId: TENANT_ID,
    userId: USER_ID,
    timestamp: new Date(),
    payload,
  };
}

function lastCreateArgs(): any {
  return (timelineService.create as any).mock.calls.at(-1)?.[0];
}

describe('clientActivityOrchestrator curated event mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CLIENT_CREATED writes a client.created entry scoped to the client', async () => {
    await clientActivityOrchestrator.onClientCreated(
      buildEvent('CLIENT_CREATED', {
        clientId: CLIENT_ID,
        name: 'Empresa ACME',
        customerType: 'commercial',
        email: 'acme@test.com',
        phone: '555-0001',
        source: 'form',
      }),
    );

    const args = lastCreateArgs();
    expect(args).toEqual(
      expect.objectContaining({
        tenantId: TENANT_ID,
        clientId: CLIENT_ID,
        entityType: 'client',
        entityId: CLIENT_ID,
        eventType: 'client.created',
        title: 'Cliente "Empresa ACME" creado',
        icon: 'user-plus',
        color: 'blue',
        performedBy: USER_ID,
      }),
    );
    expect(args.metadata).toEqual(
      expect.objectContaining({
        name: 'Empresa ACME',
        customerType: 'commercial',
        email: 'acme@test.com',
        phone: '555-0001',
        source: 'form',
      }),
    );
  });

  it('CLIENT_STATUS_CHANGED to blocked writes client.status_changed with ban/red', async () => {
    await clientActivityOrchestrator.onClientStatusChanged(
      buildEvent('CLIENT_STATUS_CHANGED', {
        clientId: CLIENT_ID,
        from: 'active',
        to: 'blocked',
        reason: 'Mora de pago',
        name: 'Empresa ACME',
      }),
    );

    const args = lastCreateArgs();
    expect(args).toEqual(
      expect.objectContaining({
        clientId: CLIENT_ID,
        entityType: 'client',
        entityId: CLIENT_ID,
        eventType: 'client.status_changed',
        title: 'Cliente bloqueado',
        icon: 'ban',
        color: 'red',
      }),
    );
    expect(args.metadata).toEqual({
      from: 'active',
      to: 'blocked',
      reason: 'Mora de pago',
      name: 'Empresa ACME',
    });
  });

  it('CLIENT_STATUS_CHANGED to active writes client.status_changed with check-circle/green', async () => {
    await clientActivityOrchestrator.onClientStatusChanged(
      buildEvent('CLIENT_STATUS_CHANGED', {
        clientId: CLIENT_ID,
        from: 'blocked',
        to: 'active',
        name: 'Empresa ACME',
      }),
    );

    const args = lastCreateArgs();
    expect(args).toEqual(
      expect.objectContaining({
        entityType: 'client',
        entityId: CLIENT_ID,
        eventType: 'client.status_changed',
        title: 'Cliente desbloqueado',
        icon: 'check-circle',
        color: 'green',
      }),
    );
    expect(args.metadata).toEqual({ from: 'blocked', to: 'active', reason: undefined, name: 'Empresa ACME' });
  });

  it('SALE_CONFIRMED client-scoped writes client.sale_confirmed', async () => {
    await clientActivityOrchestrator.onSaleConfirmed(
      buildEvent('SALE_CONFIRMED', {
        leadId: null,
        clientId: CLIENT_ID,
        amount: 5000,
        saleMode: 'quotes',
        quotesCount: 2,
      }),
    );

    const args = lastCreateArgs();
    expect(args).toEqual(
      expect.objectContaining({
        clientId: CLIENT_ID,
        entityType: 'client',
        entityId: CLIENT_ID,
        eventType: 'client.sale_confirmed',
        title: 'Venta confirmada',
        icon: 'check-circle',
        color: 'green',
      }),
    );
    expect(args.metadata).toEqual(
      expect.objectContaining({ amount: 5000, saleMode: 'quotes', quotesCount: 2 }),
    );
  });

  it('QUOTE_CREATED with clientId writes a client-scoped quote.created entry', async () => {
    await clientActivityOrchestrator.onQuoteCreated(
      buildEvent('QUOTE_CREATED', {
        quoteId: SOURCE_ID,
        number: 'COT-0001',
        leadId: null,
        clientId: CLIENT_ID,
        total: 1200,
        status: 'draft',
        validUntil: null,
        title: 'Mantenimiento anual',
        description: null,
        notes: null,
      }),
    );

    const args = lastCreateArgs();
    expect(args).toEqual(
      expect.objectContaining({
        clientId: CLIENT_ID,
        entityType: 'client',
        entityId: CLIENT_ID,
        eventType: 'quote.created',
        title: 'Mantenimiento anual',
        icon: 'file-text',
        color: 'blue',
      }),
    );
    expect(args.metadata).toEqual(
      expect.objectContaining({ number: 'COT-0001', total: 1200, sourceId: SOURCE_ID, sourceType: 'quote' }),
    );
  });

  it('QUOTE_SENT with clientId writes a client-scoped quote.sent entry', async () => {
    await clientActivityOrchestrator.onQuoteSent(
      buildEvent('QUOTE_SENT', {
        quoteId: SOURCE_ID,
        leadId: null,
        clientId: CLIENT_ID,
        number: 'COT-0001',
        total: 1200,
        title: 'Mantenimiento anual',
        status: 'sent',
      }),
    );

    const args = lastCreateArgs();
    expect(args).toEqual(
      expect.objectContaining({
        clientId: CLIENT_ID,
        entityType: 'client',
        entityId: CLIENT_ID,
        eventType: 'quote.sent',
        title: 'Mantenimiento anual',
        icon: 'send',
        color: 'indigo',
      }),
    );
    expect(args.metadata).toEqual(
      expect.objectContaining({ number: 'COT-0001', sourceId: SOURCE_ID, sourceType: 'quote' }),
    );
  });

  it('QUOTE_APPROVED with clientId writes a client-scoped quote.approved entry', async () => {
    await clientActivityOrchestrator.onQuoteApproved(
      buildEvent('QUOTE_APPROVED', {
        quoteId: SOURCE_ID,
        leadId: null,
        clientId: CLIENT_ID,
        number: 'COT-0001',
        total: 1200,
        title: 'Mantenimiento anual',
      }),
    );

    const args = lastCreateArgs();
    expect(args).toEqual(
      expect.objectContaining({
        clientId: CLIENT_ID,
        entityType: 'client',
        entityId: CLIENT_ID,
        eventType: 'quote.approved',
        title: 'Presupuesto aprobado',
        icon: 'check',
        color: 'green',
      }),
    );
    expect(args.metadata).toEqual(
      expect.objectContaining({ number: 'COT-0001', sourceId: SOURCE_ID, sourceType: 'quote' }),
    );
  });

  it('VISIT_CREATED with clientId writes a client-scoped visit.created entry', async () => {
    await clientActivityOrchestrator.onVisitCreated(
      buildEvent('VISIT_CREATED', {
        visitId: SOURCE_ID,
        leadId: null,
        clientId: CLIENT_ID,
        number: 'VT-0001',
        title: 'Visita de inspección',
        category: 'inspection',
        priority: 'high',
      }),
    );

    const args = lastCreateArgs();
    expect(args).toEqual(
      expect.objectContaining({
        clientId: CLIENT_ID,
        entityType: 'client',
        entityId: CLIENT_ID,
        eventType: 'visit.created',
        title: 'Visita de inspección',
        icon: 'map-pin',
        color: 'teal',
      }),
    );
    expect(args.metadata).toEqual(
      expect.objectContaining({ number: 'VT-0001', sourceId: SOURCE_ID, sourceType: 'visit' }),
    );
  });

  it('VISIT_COMPLETED with clientId writes a client-scoped visit.completed entry', async () => {
    await clientActivityOrchestrator.onVisitCompleted(
      buildEvent('VISIT_COMPLETED', {
        visitId: SOURCE_ID,
        number: 'VT-0001',
        clientId: CLIENT_ID,
      }),
    );

    const args = lastCreateArgs();
    expect(args).toEqual(
      expect.objectContaining({
        clientId: CLIENT_ID,
        entityType: 'client',
        entityId: CLIENT_ID,
        eventType: 'visit.completed',
        title: 'Visita VT-0001 completada',
        icon: 'check-circle',
        color: 'green',
      }),
    );
    expect(args.metadata).toEqual(
      expect.objectContaining({ number: 'VT-0001', sourceId: SOURCE_ID, sourceType: 'visit' }),
    );
  });

  it('WORK_ORDER_CREATED with clientId writes a client-scoped workorder.created entry', async () => {
    await clientActivityOrchestrator.onWorkOrderCreated(
      buildEvent('WORK_ORDER_CREATED', {
        workOrderId: SOURCE_ID,
        leadId: null,
        number: 'OT-0001',
        clientId: CLIENT_ID,
        title: 'Instalación de equipos',
        category: 'installation',
        priority: 'normal',
        clientName: 'Empresa ACME',
      }),
    );

    const args = lastCreateArgs();
    expect(args).toEqual(
      expect.objectContaining({
        clientId: CLIENT_ID,
        entityType: 'client',
        entityId: CLIENT_ID,
        eventType: 'workorder.created',
        title: 'Instalación de equipos',
        icon: 'clipboard-list',
        color: 'orange',
      }),
    );
    expect(args.metadata).toEqual(
      expect.objectContaining({ number: 'OT-0001', sourceId: SOURCE_ID, sourceType: 'work_order' }),
    );
  });

  it('WORK_ORDER_COMPLETED with clientId writes a client-scoped workorder.completed entry', async () => {
    await clientActivityOrchestrator.onWorkOrderCompleted(
      buildEvent('WORK_ORDER_COMPLETED', {
        workOrderId: SOURCE_ID,
        number: 'OT-0001',
        clientId: CLIENT_ID,
      }),
    );

    const args = lastCreateArgs();
    expect(args).toEqual(
      expect.objectContaining({
        clientId: CLIENT_ID,
        entityType: 'client',
        entityId: CLIENT_ID,
        eventType: 'workorder.completed',
        title: 'OT OT-0001 completada',
        icon: 'check-circle',
        color: 'green',
      }),
    );
    expect(args.metadata).toEqual(
      expect.objectContaining({ number: 'OT-0001', sourceId: SOURCE_ID, sourceType: 'work_order' }),
    );
  });
});

describe('clientActivityOrchestrator skip logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SALE_CONFIRMED lead-scoped is not written by the orchestrator (timelineHandler owns it)', async () => {
    await clientActivityOrchestrator.onSaleConfirmed(
      buildEvent('SALE_CONFIRMED', {
        leadId: LEAD_ID,
        clientId: CLIENT_ID,
        amount: 3000,
        saleMode: 'direct',
      }),
    );

    expect(timelineService.create).not.toHaveBeenCalled();
  });

  it('QUOTE_CREATED without clientId is not written', async () => {
    await clientActivityOrchestrator.onQuoteCreated(
      buildEvent('QUOTE_CREATED', {
        quoteId: SOURCE_ID,
        number: 'COT-0001',
        leadId: LEAD_ID,
        clientId: null,
        total: 100,
        status: 'draft',
        validUntil: null,
        title: 'Presupuesto',
        description: null,
        notes: null,
      }),
    );

    expect(timelineService.create).not.toHaveBeenCalled();
  });

  it('WORK_ORDER_COMPLETED without clientId is not written', async () => {
    await clientActivityOrchestrator.onWorkOrderCompleted(
      buildEvent('WORK_ORDER_COMPLETED', {
        workOrderId: SOURCE_ID,
        number: 'OT-0001',
        clientId: null,
      }),
    );

    expect(timelineService.create).not.toHaveBeenCalled();
  });

  it('VISIT_CREATED without clientId is not written', async () => {
    await clientActivityOrchestrator.onVisitCreated(
      buildEvent('VISIT_CREATED', {
        visitId: SOURCE_ID,
        leadId: null,
        clientId: null,
        number: 'VT-0001',
      }),
    );

    expect(timelineService.create).not.toHaveBeenCalled();
  });
});

describe('single-writer ownership (no double write)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('timelineHandler.onSaleConfirmed writes only the lead entry for lead-scoped sales', async () => {
    await timelineHandler.onSaleConfirmed(
      buildEvent('SALE_CONFIRMED', {
        leadId: LEAD_ID,
        clientId: CLIENT_ID,
        amount: 500,
        saleMode: 'quotes',
        quotesCount: 2,
      }),
    );

    const args = lastCreateArgs();
    expect(args).toEqual(
      expect.objectContaining({
        leadId: LEAD_ID,
        entityType: 'lead',
        entityId: LEAD_ID,
        eventType: 'lead.converted',
        title: 'Venta confirmada',
      }),
    );
  });

  it('timelineHandler.onSaleConfirmed with null leadId writes nothing (orchestrator owns client scope)', async () => {
    await timelineHandler.onSaleConfirmed(
      buildEvent('SALE_CONFIRMED', {
        leadId: null,
        clientId: CLIENT_ID,
        amount: 500,
        saleMode: 'direct',
      }),
    );

    expect(timelineService.create).not.toHaveBeenCalled();
  });
});

describe('clientActivityOrchestrator registration', () => {
  it('register subscribes to the curated client event set (10 events)', () => {
    const spy = vi.spyOn(eventBus, 'on');
    clientActivityOrchestrator.register();

    const subscribed = spy.mock.calls.map((c: any[]) => c[0]);
    expect(subscribed).toEqual(
      expect.arrayContaining([
        'CLIENT_CREATED',
        'CLIENT_STATUS_CHANGED',
        'SALE_CONFIRMED',
        'QUOTE_CREATED',
        'QUOTE_SENT',
        'QUOTE_APPROVED',
        'VISIT_CREATED',
        'VISIT_COMPLETED',
        'WORK_ORDER_CREATED',
        'WORK_ORDER_COMPLETED',
      ]),
    );
    expect(subscribed).toHaveLength(10);
  });
});
