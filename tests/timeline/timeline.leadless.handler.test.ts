import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainEvent } from '@/infrastructure/events/event.types';

vi.mock('@/timeline/services/timeline.service', () => ({
  timelineService: { create: vi.fn() },
}));

import { timelineHandler } from '@/timeline/handlers/timeline.handler';
import { timelineService } from '@/timeline/services/timeline.service';

const TENANT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const CLIENT_ID = 'dddddddddddddddddddddddd';

function buildEvent(type: string, payload: Record<string, unknown>): DomainEvent<any> {
  return {
    type,
    aggregateId: 'cccccccccccccccccccccccc',
    aggregateType: 'Entity',
    tenantId: TENANT_ID,
    userId: USER_ID,
    timestamp: new Date(),
    payload,
  };
}

function lastCreateArgs(): any {
  return (timelineService.create as any).mock.calls[0][0];
}

describe('timelineHandler leadless events (root-cause fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('onQuoteCreated with null leadId does not write leadId empty string', async () => {
    await timelineHandler.onQuoteCreated(
      buildEvent('QUOTE_CREATED', {
        quoteId: 'cccccccccccccccccccccccc',
        number: 'COT-1',
        leadId: null,
        total: 100,
        status: 'draft',
        validUntil: null,
        title: 'Presupuesto',
        description: null,
        notes: null,
      }),
    );

    expect(timelineService.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ leadId: '' }),
    );
    expect(lastCreateArgs().leadId).toBeUndefined();
  });

  it('onQuoteSent with null leadId does not write leadId', async () => {
    await timelineHandler.onQuoteSent(
      buildEvent('QUOTE_SENT', {
        quoteId: 'cccccccccccccccccccccccc',
        leadId: null,
        number: 'COT-1',
        total: 100,
        title: 'Presupuesto',
        status: 'sent',
        validUntil: null,
      }),
    );

    expect(timelineService.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ leadId: '' }),
    );
    expect(lastCreateArgs().leadId).toBeUndefined();
  });

  it('onQuoteRejected with null leadId does not write leadId', async () => {
    await timelineHandler.onQuoteRejected(
      buildEvent('QUOTE_REJECTED', {
        quoteId: 'cccccccccccccccccccccccc',
        leadId: null,
        number: 'COT-1',
        total: 100,
        title: 'Presupuesto',
      }),
    );

    expect(lastCreateArgs().leadId).toBeUndefined();
  });

  it('onWorkOrderCompleted does not write leadId empty string', async () => {
    await timelineHandler.onWorkOrderCompleted(
      buildEvent('WORK_ORDER_COMPLETED', {
        workOrderId: 'cccccccccccccccccccccccc',
        number: 'WO-1',
      }),
    );

    expect(lastCreateArgs().leadId).toBeUndefined();
  });

  it('onWorkOrderCreated preserves a real leadId', async () => {
    await timelineHandler.onWorkOrderCreated(
      buildEvent('WORK_ORDER_CREATED', {
        workOrderId: 'cccccccccccccccccccccccc',
        leadId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        number: 'OT-1',
        clientId: CLIENT_ID,
        title: 'OT',
      }),
    );

    const args = lastCreateArgs();
    expect(args.entityType).toBe('work_order');
    expect(args.leadId).toBe('aaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('onVisitCompleted does not write leadId empty string', async () => {
    await timelineHandler.onVisitCompleted(
      buildEvent('VISIT_COMPLETED', {
        visitId: 'cccccccccccccccccccccccc',
        number: 'VT-1',
      }),
    );

    expect(lastCreateArgs().leadId).toBeUndefined();
  });

  it('onSaleConfirmed with null leadId does not write (client scope owned by orchestrator)', async () => {
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
