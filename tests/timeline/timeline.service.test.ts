import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';

const hoisted = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFind: vi.fn(),
  sort: vi.fn(),
  limit: vi.fn(),
  populate: vi.fn(),
  lean: vi.fn(),
}));

vi.mock('@/timeline/models/timeline-event', () => ({
  default: {
    create: hoisted.mockCreate,
    find: hoisted.mockFind,
  },
}));

import { TimelineService } from '@/timeline/services/timeline.service';

const TENANT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const LEAD_ID = 'cccccccccccccccccccccccc';
const CLIENT_ID = 'dddddddddddddddddddddddd';

describe('TimelineService (client-activity foundation)', () => {
  let service: TimelineService;

  beforeEach(() => {
    service = new TimelineService();
    vi.clearAllMocks();
    hoisted.mockFind.mockReturnValue(hoisted);
    hoisted.sort.mockReturnValue(hoisted);
    hoisted.limit.mockReturnValue(hoisted);
    hoisted.populate.mockReturnValue(hoisted);
    hoisted.lean.mockResolvedValue([]);
  });

  it('create guards empty leadId so leadless events do not throw BSONError', async () => {
    hoisted.mockCreate.mockResolvedValue({ toObject: () => ({}) });

    await expect(
      service.create({
        tenantId: TENANT_ID,
        leadId: '',
        entityType: 'visit',
        entityId: CLIENT_ID,
        eventType: 'visit.completed',
        title: 'Visita completada',
        performedBy: USER_ID,
        clientId: CLIENT_ID,
      }),
    ).resolves.toBeDefined();

    const callArg = hoisted.mockCreate.mock.calls[0][0];
    expect(callArg.leadId).toBeUndefined();
    expect(callArg.clientId).toEqual(new Types.ObjectId(CLIENT_ID));
  });

  it('create casts a real leadId to ObjectId', async () => {
    hoisted.mockCreate.mockResolvedValue({ toObject: () => ({}) });

    await service.create({
      tenantId: TENANT_ID,
      leadId: LEAD_ID,
      entityType: 'lead',
      entityId: LEAD_ID,
      eventType: 'lead.created',
      title: 'Lead creado',
      performedBy: USER_ID,
    });

    const callArg = hoisted.mockCreate.mock.calls[0][0];
    expect(callArg.leadId).toEqual(new Types.ObjectId(LEAD_ID));
  });

  it('create omits clientId when not provided', async () => {
    hoisted.mockCreate.mockResolvedValue({ toObject: () => ({}) });

    await service.create({
      tenantId: TENANT_ID,
      leadId: LEAD_ID,
      entityType: 'lead',
      entityId: LEAD_ID,
      eventType: 'lead.created',
      title: 'Lead creado',
      performedBy: USER_ID,
    });

    const callArg = hoisted.mockCreate.mock.calls[0][0];
    expect(callArg.clientId).toBeUndefined();
  });

  it('findByClient filters by clientId and tenant, desc, limit 50, populate performedBy', async () => {
    await service.findByClient(CLIENT_ID, TENANT_ID);

    const findArg = hoisted.mockFind.mock.calls[0][0];
    expect(findArg).toEqual({
      clientId: new Types.ObjectId(CLIENT_ID),
      tenantId: new Types.ObjectId(TENANT_ID),
    });
    expect(hoisted.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(hoisted.limit).toHaveBeenCalledWith(50);
    expect(hoisted.populate).toHaveBeenCalledWith('performedBy', 'firstName lastName email');
  });
});
