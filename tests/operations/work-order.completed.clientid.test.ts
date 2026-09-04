import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockStartSession: vi.fn(),
  mockFindOne: vi.fn(),
  mockFindOneAndUpdate: vi.fn(),
  mockExists: vi.fn(),
  mockEventCreate: vi.fn(),
  mockValidateTransition: vi.fn(),
  mockPublish: vi.fn().mockResolvedValue(undefined),
  mockCommit: vi.fn(),
  mockAbort: vi.fn(),
  mockEndSession: vi.fn(),
  mockLogActivity: vi.fn(),
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

vi.mock('@/operations/models', () => ({
  WorkOrderModel: {
    findOne: hoisted.mockFindOne,
    findOneAndUpdate: hoisted.mockFindOneAndUpdate,
    exists: hoisted.mockExists,
  },
  WorkOrderEventModel: {
    create: hoisted.mockEventCreate,
  },
}));

vi.mock('@/crm/models', () => ({
  ClientModel: {},
  LocationModel: {},
  EquipmentModel: {},
}));

vi.mock('@/operations/helpers/state-machine', () => ({
  validateTransition: hoisted.mockValidateTransition,
  CANONICAL_STATUSES: ['draft', 'scheduled', 'assigned', 'in_progress', 'paused', 'completed', 'closed', 'cancelled'],
}));

vi.mock('@/operations/helpers/counter', () => ({
  getNextWorkOrderNumber: vi.fn(),
}));

vi.mock('@/audit/activity-logger', () => ({
  logActivity: hoisted.mockLogActivity,
}));

vi.mock('@/infrastructure/events/event-bus', () => ({
  eventBus: { publish: hoisted.mockPublish },
}));

import { WorkOrderService } from '@/operations/services/work-order.service';
import { DOMAIN_EVENTS } from '@/infrastructure/events/event.types';

const TENANT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const CLIENT_ID = 'dddddddddddddddddddddddd';
const WO_ID = 'cccccccccccccccccccccccc';

function publishedPayload(type: string) {
  const call = hoisted.mockPublish.mock.calls.find((c: any[]) => c[0].type === type);
  return call ? call[0].payload : undefined;
}

describe('WorkOrderService WORK_ORDER_COMPLETED payload', () => {
  let service: WorkOrderService;

  beforeEach(() => {
    service = new WorkOrderService();
    vi.clearAllMocks();
    hoisted.mockStartSession.mockResolvedValue(mockSession);
    hoisted.mockCommit.mockResolvedValue(undefined);
    hoisted.mockAbort.mockResolvedValue(undefined);
    hoisted.mockEndSession.mockResolvedValue(undefined);
    hoisted.mockEventCreate.mockResolvedValue([{}]);
  });

  it('publishes WORK_ORDER_COMPLETED with clientId when a work order completes', async () => {
    const current = {
      status: 'in_progress',
      version: 3,
      workOrderNumber: 'OT-0001',
      title: 'Instalación',
      category: 'installation',
      clientId: { toString: () => CLIENT_ID },
    };

    hoisted.mockFindOne.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      session: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(current),
    }));
    hoisted.mockFindOneAndUpdate.mockImplementation(() => ({
      session: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue({ ...current, status: 'completed', version: 4 }),
    }));

    await service.changeStatus(WO_ID, 'completed', {} as any, TENANT_ID, USER_ID, 3);

    expect(publishedPayload(DOMAIN_EVENTS.WORK_ORDER_COMPLETED)?.clientId).toBe(CLIENT_ID);
  });
});
