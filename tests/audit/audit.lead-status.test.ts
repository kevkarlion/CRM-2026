import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainEvent, DOMAIN_EVENTS } from '@/infrastructure/events/event.types';

vi.mock('@/audit/services/activity-log.service', () => ({
  activityLogService: { create: vi.fn() },
}));

import { auditHandler } from '@/audit/handlers/audit.handler';
import { activityLogService } from '@/audit/services/activity-log.service';

const TENANT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const LEAD_ID = 'cccccccccccccccccccccccc';

function buildEvent(
  type: string,
  payload: Record<string, unknown> = {},
  aggregateType = 'Lead',
): DomainEvent {
  return {
    type,
    aggregateId: LEAD_ID,
    aggregateType,
    tenantId: TENANT_ID,
    userId: USER_ID,
    timestamp: new Date(),
    payload,
  };
}

describe('auditHandler lead status-change coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('LEAD_STATUS_CHANGED maps to exactly one "status_changed" row with from/to metadata', async () => {
    await auditHandler.onAnyEvent(
      buildEvent(DOMAIN_EVENTS.LEAD_STATUS_CHANGED, {
        leadId: LEAD_ID,
        from: 'contacted',
        to: 'quote_sent',
        leadName: 'Juan Perez',
      }),
    );

    expect(activityLogService.create).toHaveBeenCalledTimes(1);
    expect(activityLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        entityType: 'Lead',
        entityId: LEAD_ID,
        action: 'status_changed',
        actorId: USER_ID,
        metadata: expect.objectContaining({
          from: 'contacted',
          to: 'quote_sent',
          leadName: 'Juan Perez',
          leadId: LEAD_ID,
        }),
      }),
    );
  });

  it('LEAD_RESOLVED maps to "resolved" (not the generic "updated" fallback)', async () => {
    await auditHandler.onAnyEvent(
      buildEvent(
        DOMAIN_EVENTS.LEAD_RESOLVED,
        { leadId: LEAD_ID, clientId: 'dddddddddddddddddddddddd', resolvedBy: USER_ID },
        'lead',
      ),
    );

    expect(activityLogService.create).toHaveBeenCalledTimes(1);
    expect(activityLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'resolved', entityType: 'lead' }),
    );
  });

  it('CLIENT_RESOLVED maps to "resolved"', async () => {
    await auditHandler.onAnyEvent(
      buildEvent(
        DOMAIN_EVENTS.CLIENT_RESOLVED,
        { clientId: 'dddddddddddddddddddddddd', resolvedBy: USER_ID },
        'Client',
      ),
    );

    expect(activityLogService.create).toHaveBeenCalledTimes(1);
    expect(activityLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'resolved' }),
    );
  });

  it('SALE_CONFIRMED enrichments (from/to) are spread into the audit metadata', async () => {
    await auditHandler.onAnyEvent(
      buildEvent(DOMAIN_EVENTS.SALE_CONFIRMED, {
        leadId: LEAD_ID,
        clientId: null,
        amount: 500,
        saleMode: 'direct',
        from: 'quote_sent',
        to: 'won',
      } as unknown as Record<string, unknown>),
    );

    expect(activityLogService.create).toHaveBeenCalledTimes(1);
    expect(activityLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'status_changed',
        metadata: expect.objectContaining({ from: 'quote_sent', to: 'won', saleMode: 'direct' }),
      }),
    );
  });
});