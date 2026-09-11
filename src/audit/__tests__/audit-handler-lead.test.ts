import { describe, it, expect, vi, beforeEach } from 'vitest';

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn().mockResolvedValue(undefined) }));
const { onMock } = vi.hoisted(() => ({ onMock: vi.fn() }));

vi.mock('@/audit/services/activity-log.service', () => ({
  activityLogService: { create: createMock },
}));

vi.mock('@/infrastructure/events/event-bus', () => ({
  eventBus: { on: onMock },
}));

import { auditHandler } from '../handlers/audit.handler';
import { DomainEvent } from '@/infrastructure/events/event.types';

const LEAD_ID = '65f4d9c2a1b2c3d4e5f6a7b8';
const BOT_ACTOR_ID = '000000000000000000000000';

function leadEvent(type: string, payload: Record<string, unknown>): DomainEvent {
  return {
    type,
    aggregateId: LEAD_ID,
    aggregateType: 'Lead',
    tenantId: 'tenant-abc',
    userId: BOT_ACTOR_ID,
    timestamp: new Date('2026-01-15T10:00:00.000Z'),
    payload,
  };
}

describe('auditHandler.onAnyEvent', () => {
  beforeEach(() => {
    createMock.mockClear();
  });

  it('persists enriched LEAD_CREATED metadata (free-text PII is stripped)', async () => {
    await auditHandler.onAnyEvent(
      leadEvent('LEAD_CREATED', {
        leadId: LEAD_ID,
        name: 'Juan Pérez',
        source: 'whatsapp',
        phone: '+5492984001234',
        profileName: 'Juan',
        companyName: 'Acme SRL',
        status: 'contacted',
        score: 8,
        temperature: 'hot',
        address: 'Av. Roca 123',
        notes: 'Servicio: Reparación',
        email: 'juan@acme.com',
        description: 'free text',
        inquiryReason: 'repair',
        qualificationStatus: 'pending',
        priority: 'high',
        locality: 'Trelew',
        province: 'Chubut',
      }),
    );

    expect(createMock).toHaveBeenCalledTimes(1);
    const call = createMock.mock.calls[0][0];
    expect(call.action).toBe('created');
    expect(call.entityType).toBe('Lead');
    expect(call.entityId).toBe(LEAD_ID);
    expect(call.actorId).toBe(BOT_ACTOR_ID);
    expect(call.tenantId).toBe('tenant-abc');

    expect(call.metadata).toMatchObject({
      eventType: 'LEAD_CREATED',
      source: 'whatsapp',
      name: 'Juan Pérez',
      phone: '+5492984001234',
      profileName: 'Juan',
      companyName: 'Acme SRL',
      status: 'contacted',
      score: 8,
      temperature: 'hot',
      address: 'Av. Roca 123',
      inquiryReason: 'repair',
      qualificationStatus: 'pending',
      priority: 'high',
      locality: 'Trelew',
      province: 'Chubut',
    });

    expect(call.metadata.notes).toBeUndefined();
    expect(call.metadata.email).toBeUndefined();
    expect(call.metadata.description).toBeUndefined();
  });

  it('persists LEAD_STATUS_CHANGED metadata with from/to for the new -> contacted transition', async () => {
    await auditHandler.onAnyEvent(
      leadEvent('LEAD_STATUS_CHANGED', {
        leadId: LEAD_ID,
        from: 'new',
        to: 'contacted',
        leadName: 'Juan Pérez',
      }),
    );

    expect(createMock).toHaveBeenCalledTimes(1);
    const call = createMock.mock.calls[0][0];
    expect(call.action).toBe('status_changed');
    expect(call.entityType).toBe('Lead');
    expect(call.entityId).toBe(LEAD_ID);
    expect(call.metadata).toMatchObject({
      from: 'new',
      to: 'contacted',
      leadName: 'Juan Pérez',
    });
  });

  it('skips events that cannot be attributed to an entity', async () => {
    await auditHandler.onAnyEvent({
      type: 'LEAD_CREATED',
      aggregateId: '',
      aggregateType: '',
      tenantId: 'tenant-abc',
      userId: BOT_ACTOR_ID,
      timestamp: new Date(),
      payload: {},
    });

    expect(createMock).not.toHaveBeenCalled();
  });
});