import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockStartSession: vi.fn(),
  mockCreate: vi.fn(),
  mockCountDocuments: vi.fn(),
  mockFindOne: vi.fn(),
  mockFindOneAndUpdate: vi.fn(),
  mockPublish: vi.fn().mockResolvedValue(undefined),
  mockCommit: vi.fn(),
  mockAbort: vi.fn(),
  mockEndSession: vi.fn(),
}));

const mockSession = {
  startTransaction: vi.fn(),
  commitTransaction: hoisted.mockCommit,
  abortTransaction: hoisted.mockAbort,
  endSession: hoisted.mockEndSession,
};

vi.mock('mongoose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('mongoose')>();
  return {
    ...actual,
    startSession: hoisted.mockStartSession,
    default: {
      ...(actual as any).default,
      startSession: hoisted.mockStartSession,
    },
  };
});

vi.mock('@/operations/models/technical-visit', () => ({
  TechnicalVisitModel: {
    create: hoisted.mockCreate,
    countDocuments: hoisted.mockCountDocuments,
    findOne: hoisted.mockFindOne,
    findOneAndUpdate: hoisted.mockFindOneAndUpdate,
  },
}));

vi.mock('@/infrastructure/events/event-bus', () => ({
  eventBus: { publish: hoisted.mockPublish },
}));

import { technicalVisitService } from '@/operations/services/technical-visit.service';
import { DOMAIN_EVENTS } from '@/infrastructure/events/event.types';

const TENANT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const CLIENT_ID = 'dddddddddddddddddddddddd';
const VISIT_ID = 'cccccccccccccccccccccccc';

function publishedPayload(type: string) {
  const call = hoisted.mockPublish.mock.calls.find((c: any[]) => c[0].type === type);
  return call ? call[0].payload : undefined;
}

describe('TechnicalVisitService publishes clientId in payloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockStartSession.mockResolvedValue(mockSession);
    hoisted.mockCommit.mockResolvedValue(undefined);
    hoisted.mockAbort.mockResolvedValue(undefined);
    hoisted.mockEndSession.mockResolvedValue(undefined);
    hoisted.mockCountDocuments.mockImplementation(() => ({
      session: vi.fn().mockResolvedValue(0),
    }));
  });

  it('VISIT_CREATED payload carries clientId when visit is client-originated', async () => {
    hoisted.mockCreate.mockResolvedValue([{ _id: VISIT_ID, toObject: () => ({ _id: VISIT_ID }) }]);

    await technicalVisitService.create(
      { clientId: { toString: () => CLIENT_ID }, title: 'Visita técnica' } as any,
      TENANT_ID,
      USER_ID,
    );

    expect(publishedPayload(DOMAIN_EVENTS.VISIT_CREATED)?.clientId).toBe(CLIENT_ID);
  });

  it('VISIT_COMPLETED payload carries clientId when visit is client-originated', async () => {
    const current = {
      _id: VISIT_ID,
      visitNumber: 'VT-0001',
      title: 'Visita técnica',
      status: 'scheduled',
      clientId: { toString: () => CLIENT_ID },
    };
    hoisted.mockFindOne.mockImplementation(() => ({
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(current),
    }));
    hoisted.mockFindOneAndUpdate.mockImplementation(() => ({
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ ...current, status: 'completed' }),
    }));

    await technicalVisitService.updateStatus(VISIT_ID, 'completed', TENANT_ID, USER_ID);

    expect(publishedPayload(DOMAIN_EVENTS.VISIT_COMPLETED)?.clientId).toBe(CLIENT_ID);
  });

  it('VISIT_CREATED payload publishes null clientId for lead-originated visits', async () => {
    hoisted.mockCreate.mockResolvedValue([{ _id: VISIT_ID, toObject: () => ({ _id: VISIT_ID }) }]);

    await technicalVisitService.create(
      { title: 'Visita técnica', leadId: { toString: () => 'aaaaaaaaaaaaaaaaaaaaaaaa' } } as any,
      TENANT_ID,
      USER_ID,
    );

    expect(publishedPayload(DOMAIN_EVENTS.VISIT_CREATED)?.clientId).toBeNull();
  });
});
