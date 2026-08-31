import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockStartSession: vi.fn(),
  mockFindOne: vi.fn(),
  mockFindOneAndUpdate: vi.fn(),
  mockFindById: vi.fn(),
  mockAssignmentFindOne: vi.fn(),
  mockValidateWorkReportInput: vi.fn(),
  mockCreateForWorkOrder: vi.fn(),
  mockLogActivity: vi.fn(),
  mockPublish: vi.fn(),
}));

const mockSession = {
  startTransaction: vi.fn(),
  commitTransaction: vi.fn().mockResolvedValue(undefined),
  abortTransaction: vi.fn().mockResolvedValue(undefined),
  endSession: vi.fn(),
};

vi.mock('@/core/db', () => ({ connectDB: vi.fn() }));

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
    findByIdAndUpdate: hoisted.mockFindOneAndUpdate,
  },
}));

vi.mock('@/operations/models/technician', () => ({
  TechnicianModel: {
    findById: hoisted.mockFindById,
    findByIdAndUpdate: vi.fn().mockReturnValue({ session: vi.fn().mockResolvedValue({}) }),
  },
}));

vi.mock('@/operations/models/work-order-assignment', () => ({
  default: {
    findOne: hoisted.mockAssignmentFindOne,
  },
}));

vi.mock('@/operations/services/work-report.service', () => {
  class WorkReportService {
    validateWorkReportInput = hoisted.mockValidateWorkReportInput;
    createForWorkOrder = hoisted.mockCreateForWorkOrder;
  }
  return { WorkReportService };
});

vi.mock('@/audit/activity-logger', () => ({
  logActivity: hoisted.mockLogActivity,
}));

vi.mock('@/infrastructure/events/event-bus', () => ({
  eventBus: { publish: hoisted.mockPublish },
}));

vi.mock('@/lib/sse-broadcast', () => ({
  broadcastWorkReportCompleted: vi.fn(),
}));

import { POST } from '@/app/api/operations/work-orders/[id]/complete/route';

const TENANT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const WO_ID = 'cccccccccccccccccccccccc';
const TECH_ID = 'dddddddddddddddddddddddd';

function mockRequest(overrides: Record<string, unknown> = {}) {
  return {
    headers: new Headers({ 'x-tenant-id': TENANT_ID, 'x-user-id': USER_ID }),
    json: vi.fn().mockResolvedValue({
      result: 'Reparación completada',
      workPerformed: ['Limpieza'],
      arrivalTime: '2026-08-31T09:00:00Z',
      departureTime: '2026-08-31T11:00:00Z',
      internalComments: 'Comentario interno',
      materialsItems: [{ item: 'Filtro', quantity: 2, unit: 'unidad' }],
      ...overrides,
    }),
  } as any;
}

function mockParams() {
  return { params: Promise.resolve({ id: WO_ID }) };
}

describe('POST /complete — new WorkReport fields pass-through', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockStartSession.mockResolvedValue(mockSession);
    hoisted.mockFindOne.mockReturnValue({
      session: vi.fn().mockResolvedValue({
        _id: WO_ID,
        status: 'in_progress',
        startedAt: new Date('2026-08-31T08:00:00Z'),
        assignedTechnicians: [TECH_ID],
        workOrderNumber: 'OT-0001',
        title: 'Instalación',
        clientId: { toString: () => 'client' },
      }),
    });
    hoisted.mockAssignmentFindOne.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        session: vi.fn().mockResolvedValue({ technicianId: { _id: TECH_ID, userId: USER_ID } }),
      }),
    });
    hoisted.mockValidateWorkReportInput.mockReturnValue({ valid: true, errors: [] });
    hoisted.mockCreateForWorkOrder.mockResolvedValue({ _id: 'wr1' });
    hoisted.mockFindOneAndUpdate.mockReturnValue({ session: vi.fn().mockResolvedValue({}) });
    hoisted.mockFindById.mockReturnValue({
      _id: TECH_ID,
      userId: USER_ID,
      firstName: 'Juan',
      lastName: 'Perez',
    });
  });

  it('passes arrivalTime, departureTime, internalComments and materialsItems to createForWorkOrder', async () => {
    const res = await POST(mockRequest(), mockParams());
    expect(res.status).toBe(200);

    const [woId, workReportData] = hoisted.mockCreateForWorkOrder.mock.calls[0];
    expect(woId).toBe(WO_ID);
    expect(workReportData.arrivalTime).toBe('2026-08-31T09:00:00Z');
    expect(workReportData.departureTime).toBe('2026-08-31T11:00:00Z');
    expect(workReportData.internalComments).toBe('Comentario interno');
    expect(workReportData.materialsItems).toEqual([
      { item: 'Filtro', quantity: 2, unit: 'unidad' },
    ]);
  });

  it('works when the new optional fields are absent', async () => {
    const res = await POST(
      mockRequest({ arrivalTime: undefined, departureTime: undefined, internalComments: undefined, materialsItems: undefined }),
      mockParams(),
    );
    expect(res.status).toBe(200);

    const [, workReportData] = hoisted.mockCreateForWorkOrder.mock.calls[0];
    expect(workReportData.arrivalTime).toBeUndefined();
    expect(workReportData.departureTime).toBeUndefined();
    expect(workReportData.internalComments).toBeUndefined();
    expect(workReportData.materialsItems).toBeUndefined();
  });
});
