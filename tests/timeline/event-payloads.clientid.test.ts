import { describe, it, expect } from 'vitest';
import { DOMAIN_EVENTS } from '@/infrastructure/events/event.types';
import type {
  QuoteCreatedPayload,
  QuoteSentPayload,
  QuoteApprovedPayload,
  QuoteRejectedPayload,
  VisitCreatedPayload,
  VisitCompletedPayload,
  WorkOrderCompletedPayload,
  ClientCreatedPayload,
  ClientStatusChangedPayload,
} from '@/infrastructure/events/event.types';

describe('client-activity event payloads', () => {
  it('defines CLIENT_CREATED and CLIENT_STATUS_CHANGED constants', () => {
    expect(DOMAIN_EVENTS.CLIENT_CREATED).toBe('CLIENT_CREATED');
    expect(DOMAIN_EVENTS.CLIENT_STATUS_CHANGED).toBe('CLIENT_STATUS_CHANGED');
  });

  it('quote payloads carry an optional clientId', () => {
    const quoteCreated: QuoteCreatedPayload = {
      quoteId: 'x',
      number: 'COT-1',
      leadId: null,
      clientId: null,
      total: 0,
      status: 'draft',
      validUntil: null,
      title: '',
      description: null,
      notes: null,
    };
    const quoteSent: QuoteSentPayload = { quoteId: 'x', number: 'COT-1', leadId: null, clientId: null, total: 0 };
    const quoteApproved: QuoteApprovedPayload = { quoteId: 'x', leadId: null, clientId: null };
    const quoteRejected: QuoteRejectedPayload = { quoteId: 'x', leadId: null, clientId: null };

    expect([quoteCreated, quoteSent, quoteApproved, quoteRejected]).toBeDefined();
  });

  it('visit payloads carry an optional clientId', () => {
    const visitCreated: VisitCreatedPayload = { visitId: 'x', number: 'VT-1', leadId: null, clientId: null };
    const visitCompleted: VisitCompletedPayload = { visitId: 'x', clientId: null };

    expect([visitCreated, visitCompleted]).toBeDefined();
  });

  it('work order completed payload carries clientId', () => {
    const workOrderCompleted: WorkOrderCompletedPayload = { workOrderId: 'x', clientId: null };

    expect(workOrderCompleted).toBeDefined();
  });

  it('defines client payload interfaces for Phase 2 events', () => {
    const clientCreated: ClientCreatedPayload = { clientId: 'x', name: 'Acme', status: 'active' };
    const clientStatusChanged: ClientStatusChangedPayload = { clientId: 'x', from: 'active', to: 'blocked' };

    expect([clientCreated, clientStatusChanged]).toBeDefined();
  });
});
