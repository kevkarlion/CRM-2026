import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockConnectDB: vi.fn(),
  mockListQuotes: vi.fn(),
  mockFind: vi.fn(),
  MockObjectId: class MockObjectId {
    constructor(public value = '') {}
    toString() {
      return this.value;
    }
  },
}));

vi.mock('@/core/db', () => ({
  connectDB: hoisted.mockConnectDB,
}));

vi.mock('@/quotes/services', () => ({
  QuoteService: vi.fn().mockImplementation(() => ({
    listQuotes: hoisted.mockListQuotes,
  })),
  ValidationError: class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  },
}));

vi.mock('mongoose', () => ({
  default: {
    Types: { ObjectId: hoisted.MockObjectId },
    models: { WorkOrder: { find: hoisted.mockFind } },
  },
}));

vi.mock('@/crm/models/client', () => ({
  default: {},
}));

import { GET } from '@/app/api/crm/quotes/route';

function findChain(result: any[]) {
  return {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

function mockRequest(tenantId = 'tenant-1') {
  return {
    headers: new Headers({ 'x-tenant-id': tenantId }),
    url: 'http://localhost:3000/api/crm/quotes',
  } as any;
}

describe('GET /api/crm/quotes (sibling WO enrichment)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockConnectDB.mockResolvedValue(undefined);
  });

  it('resolves populated leadId and marks leadHasWorkOrder=false when the lead has no WO', async () => {
    hoisted.mockListQuotes.mockResolvedValue({
      data: [
        {
          _id: 'q1',
          number: 'Q-001',
          status: 'approved',
          total: 1000,
          subtotal: 1000,
          title: 'Quote 1',
          createdAt: '2026-06-01T00:00:00Z',
          leadId: { _id: 'lead-1', name: 'Acme', status: 'won' },
        },
      ],
    });
    hoisted.mockFind.mockReturnValue(findChain([]));

    const response = await GET(mockRequest());
    const body = await response.json();

    expect(body.data[0].leadHasWorkOrder).toBe(false);
    expect(body.data[0].leadWorkOrderStatus).toBeNull();

    const filter = hoisted.mockFind.mock.calls[0][0];
    expect(filter.tenantId).toBeInstanceOf(hoisted.MockObjectId);
    expect(filter.tenantId.value).toBe('tenant-1');
    expect(filter.leadId.$in).toHaveLength(1);
    expect(filter.leadId.$in[0].value).toBe('lead-1');
    expect(filter.deletedAt).toBeNull();
  });

  it('marks leadHasWorkOrder=true with the sibling lead WO status', async () => {
    hoisted.mockListQuotes.mockResolvedValue({
      data: [
        {
          _id: 'q2',
          number: 'Q-002',
          status: 'approved',
          total: 1000,
          subtotal: 1000,
          title: 'Quote 2',
          createdAt: '2026-06-02T00:00:00Z',
          leadId: 'lead-2',
        },
      ],
    });
    hoisted.mockFind.mockReturnValue(
      findChain([{ _id: 'wo-lead', leadId: 'lead-2', status: 'closed' }]),
    );

    const response = await GET(mockRequest());
    const body = await response.json();

    expect(body.data[0].leadHasWorkOrder).toBe(true);
    expect(body.data[0].leadWorkOrderStatus).toBe('closed');
  });

  it('skips sibling enrichment when the quote owns a work order (own-WO wins)', async () => {
    hoisted.mockListQuotes.mockResolvedValue({
      data: [
        {
          _id: 'q3',
          number: 'Q-003',
          status: 'approved',
          total: 1000,
          subtotal: 1000,
          title: 'Quote 3',
          createdAt: '2026-06-03T00:00:00Z',
          leadId: { _id: 'lead-3', name: 'Acme', status: 'won' },
          convertedToWorkOrder: 'wo-9',
        },
      ],
    });
    hoisted.mockFind
      .mockReturnValueOnce(findChain([{ _id: 'wo-9', status: 'scheduled' }]))
      .mockReturnValueOnce(
        findChain([{ _id: 'wo-lead', leadId: 'lead-3', status: 'closed' }]),
      );

    const response = await GET(mockRequest());
    const body = await response.json();

    expect(body.data[0].workOrderStatus).toBe('scheduled');
    expect(body.data[0].leadHasWorkOrder).toBeUndefined();
    expect(body.data[0].leadWorkOrderStatus).toBeUndefined();
  });
});