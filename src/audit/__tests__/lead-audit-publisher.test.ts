import { describe, it, expect, vi, beforeEach } from 'vitest';

const { publishMock } = vi.hoisted(() => ({ publishMock: vi.fn() }));

vi.mock('@/infrastructure/events/event-bus', () => ({
  eventBus: { publish: publishMock },
}));

import { publishCompletedBotLeadAudit, BOT_ACTOR_ID } from '../services/lead-audit-publisher';
import { DOMAIN_EVENTS } from '@/infrastructure/events/event.types';

// Full data captured by the WhatsApp bot when a flow completes (new -> contacted).
const completedLead = {
  leadId: '65f4d9c2a1b2c3d4e5f6a7b8',
  name: 'Juan Pérez',
  source: 'whatsapp',
  profileName: 'Juan',
  companyName: 'Acme SRL',
  phone: '+5492984001234',
  status: 'contacted',
  score: 8,
  temperature: 'hot',
  address: 'Av. Roca 123',
  notes: 'Servicio: Reparación | Necesidad: Hoy',
  inquiryReason: 'repair',
  qualificationStatus: 'pending',
  priority: 'high',
  locality: 'Trelew',
  province: 'Chubut',
};

describe('publishCompletedBotLeadAudit', () => {
  beforeEach(() => {
    publishMock.mockReset();
    publishMock.mockResolvedValue(undefined);
  });

  it('publishes LEAD_CREATED with the full enriched payload', async () => {
    await publishCompletedBotLeadAudit(completedLead, 'tenant-abc');

    expect(publishMock).toHaveBeenCalledTimes(2);

    const createdEvent = publishMock.mock.calls[0][0];
    expect(createdEvent.type).toBe(DOMAIN_EVENTS.LEAD_CREATED);
    expect(createdEvent.aggregateType).toBe('Lead');
    expect(createdEvent.aggregateId).toBe(completedLead.leadId);
    expect(createdEvent.tenantId).toBe('tenant-abc');
    expect(createdEvent.userId).toBe(BOT_ACTOR_ID);
    expect(createdEvent.timestamp).toBeInstanceOf(Date);
    expect(createdEvent.payload).toMatchObject({
      leadId: completedLead.leadId,
      name: 'Juan Pérez',
      source: 'whatsapp',
      phone: '+5492984001234',
      profileName: 'Juan',
      companyName: 'Acme SRL',
      status: 'contacted',
      score: 8,
      temperature: 'hot',
      address: 'Av. Roca 123',
      notes: 'Servicio: Reparación | Necesidad: Hoy',
      inquiryReason: 'repair',
      qualificationStatus: 'pending',
      priority: 'high',
      locality: 'Trelew',
      province: 'Chubut',
    });
  });

  it('publishes LEAD_STATUS_CHANGED with from=new and to=contacted', async () => {
    await publishCompletedBotLeadAudit(completedLead, 'tenant-abc');

    const statusEvent = publishMock.mock.calls[1][0];
    expect(statusEvent.type).toBe(DOMAIN_EVENTS.LEAD_STATUS_CHANGED);
    expect(statusEvent.aggregateType).toBe('Lead');
    expect(statusEvent.aggregateId).toBe(completedLead.leadId);
    expect(statusEvent.tenantId).toBe('tenant-abc');
    expect(statusEvent.userId).toBe(BOT_ACTOR_ID);
    expect(statusEvent.payload).toEqual({
      leadId: completedLead.leadId,
      from: 'new',
      to: 'contacted',
      leadName: 'Juan Pérez',
    });
  });

  it('swallows publish failures without throwing (best-effort audit)', async () => {
    publishMock.mockRejectedValue(new Error('event bus down'));

    await expect(
      publishCompletedBotLeadAudit(completedLead, 'tenant-abc'),
    ).resolves.toBeUndefined();
  });
});