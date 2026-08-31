import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const exec = vi.fn();
  const chain: any = { select: vi.fn(), populate: vi.fn(), sort: vi.fn(), exec };
  chain.select.mockReturnValue(chain);
  chain.populate.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);

  const session = {
    startTransaction: vi.fn(),
    abortTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    endSession: vi.fn(),
  };

  return {
    chain,
    session,
    mockStartSession: vi.fn().mockResolvedValue(session),
    mockQuoteCreate: vi.fn(),
    mockQuoteVersionCreate: vi.fn(),
    mockValidateTransition: vi.fn(),
    mockValidateSendRequirements: vi.fn(),
    mockValidateApproveRequirements: vi.fn(),
    mockGetNextQuoteNumber: vi.fn(),
    mockProcessItems: vi.fn(),
    mockCalculateSubtotal: vi.fn(),
    mockCalculateTotal: vi.fn(),
    mockLogActivity: vi.fn(),
    mockCursorPage: vi.fn(),
    mockTenantFindById: vi.fn(),
    mockFindOneAndUpdate: vi.fn(() => chain),
    mockPublish: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('mongoose', () => {
  class MockObjectId {
    private value: string;
    constructor(_id?: string) {
      this.value = _id || '';
    }
    toString() {
      return this.value;
    }
  }
  return {
    Types: { ObjectId: MockObjectId as any },
    Schema: class {
      static Types = { ObjectId: MockObjectId };
      index(..._args: any[]) {
        return this;
      }
    },
    model: vi.fn(),
    models: {},
    Document: class {},
    startSession: hoisted.mockStartSession,
    default: {
      Types: { ObjectId: MockObjectId as any },
      Schema: class {
        static Types = { ObjectId: MockObjectId };
        index(..._args: any[]) {
          return this;
        }
      },
      model: vi.fn(),
      models: {},
      startSession: hoisted.mockStartSession,
    },
  };
});

vi.mock('@/quotes/models/quote', () => ({
  default: {
    create: hoisted.mockQuoteCreate,
    findOne: vi.fn(() => hoisted.chain),
    findOneAndUpdate: hoisted.mockFindOneAndUpdate,
  },
}));

vi.mock('@/quotes/models/quote-version', () => ({
  default: {
    create: hoisted.mockQuoteVersionCreate,
    findOne: vi.fn(() => hoisted.chain),
  },
}));

vi.mock('@/quotes/helpers/state-machine', () => ({
  validateTransition: hoisted.mockValidateTransition,
  validateSendRequirements: hoisted.mockValidateSendRequirements,
  validateApproveRequirements: hoisted.mockValidateApproveRequirements,
}));

vi.mock('@/quotes/helpers/counter', () => ({
  getNextQuoteNumber: hoisted.mockGetNextQuoteNumber,
}));

vi.mock('@/quotes/helpers/calculator', () => ({
  processItems: hoisted.mockProcessItems,
  calculateSubtotal: hoisted.mockCalculateSubtotal,
  calculateTotal: hoisted.mockCalculateTotal,
}));

vi.mock('@/audit/activity-logger', () => ({
  logActivity: hoisted.mockLogActivity,
}));

vi.mock('@/crm/helpers/cursor-pagination', () => ({
  cursorPage: hoisted.mockCursorPage,
}));

vi.mock('@/core/models/tenant', () => ({
  default: {
    findById: hoisted.mockTenantFindById,
  },
}));

vi.mock('@/leads/models/lead', () => ({
  default: {
    findOne: vi.fn(() => hoisted.chain),
    updateOne: vi.fn(),
  },
}));

vi.mock('@/core/models/user', () => ({}));

vi.mock('@/crm/models/client', () => ({}));

vi.mock('@/infrastructure/events/event-bus', () => ({
  eventBus: { publish: hoisted.mockPublish },
}));

import { QuoteService } from '@/quotes/services/quote.service';
import { DOMAIN_EVENTS } from '@/infrastructure/events/event.types';

const TENANT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const CLIENT_ID = 'dddddddddddddddddddddddd';

function quoteDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'quote1',
    tenantId: TENANT_ID,
    number: 'COT-0001',
    title: 'Presupuesto',
    status: 'draft',
    total: 1000,
    validUntil: null,
    leadId: null,
    clientId: { toString: () => CLIENT_ID },
    currentVersion: 1,
    toObject() {
      return { ...this };
    },
    ...overrides,
  };
}

function publishedPayload(type: string) {
  const call = hoisted.mockPublish.mock.calls.find((c: any[]) => c[0].type === type);
  return call ? call[0].payload : undefined;
}

describe('QuoteService publishes clientId in payloads', () => {
  let service: QuoteService;

  beforeEach(() => {
    service = new QuoteService();
    vi.clearAllMocks();
    hoisted.chain.exec.mockReset();
  });

  it('QUOTE_CREATED payload carries clientId for client-originated quotes', async () => {
    hoisted.mockGetNextQuoteNumber.mockResolvedValue('COT-0001');
    hoisted.mockProcessItems.mockImplementation((items: any[]) => items);
    hoisted.mockCalculateSubtotal.mockReturnValue(1000);
    hoisted.mockCalculateTotal.mockReturnValue(1000);
    hoisted.mockQuoteCreate.mockResolvedValue([quoteDoc()]);
    hoisted.mockQuoteVersionCreate.mockResolvedValue([{ toObject: () => ({}) }]);
    hoisted.mockTenantFindById.mockReturnValue(hoisted.chain);
    hoisted.chain.exec.mockResolvedValueOnce(null);

    await service.createQuote(
      {
        items: [{ description: 'Item A', type: 'product', quantity: 1, unitPrice: 1000, subtotal: 1000 }],
        title: 'Presupuesto',
        clientId: CLIENT_ID,
        leadId: null,
      } as any,
      USER_ID,
      TENANT_ID,
    );

    expect(publishedPayload(DOMAIN_EVENTS.QUOTE_CREATED)?.clientId).toBe(CLIENT_ID);
  });

  it('QUOTE_SENT payload carries clientId for client-originated quotes', async () => {
    hoisted.chain.exec
      .mockResolvedValueOnce(quoteDoc())
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce(quoteDoc({ status: 'sent' }));

    await service.sendQuote('quote1', USER_ID, TENANT_ID);

    expect(publishedPayload(DOMAIN_EVENTS.QUOTE_SENT)?.clientId).toBe(CLIENT_ID);
  });

  it('QUOTE_APPROVED payload carries clientId for client-originated quotes', async () => {
    hoisted.chain.exec
      .mockResolvedValueOnce(quoteDoc({ status: 'sent' }))
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce(quoteDoc({ status: 'approved' }));

    await service.approveQuote('quote1', USER_ID, TENANT_ID);

    expect(publishedPayload(DOMAIN_EVENTS.QUOTE_APPROVED)?.clientId).toBe(CLIENT_ID);
  });

  it('QUOTE_CREATED payload publishes null clientId for lead-originated quotes', async () => {
    hoisted.mockGetNextQuoteNumber.mockResolvedValue('COT-0001');
    hoisted.mockProcessItems.mockImplementation((items: any[]) => items);
    hoisted.mockCalculateSubtotal.mockReturnValue(1000);
    hoisted.mockCalculateTotal.mockReturnValue(1000);
    hoisted.mockQuoteCreate.mockResolvedValue([quoteDoc()]);
    hoisted.mockQuoteVersionCreate.mockResolvedValue([{ toObject: () => ({}) }]);
    hoisted.mockTenantFindById.mockReturnValue(hoisted.chain);
    hoisted.chain.exec.mockResolvedValueOnce(null);

    await service.createQuote(
      {
        items: [{ description: 'Item A', type: 'product', quantity: 1, unitPrice: 1000, subtotal: 1000 }],
        title: 'Presupuesto',
        leadId: null,
      } as any,
      USER_ID,
      TENANT_ID,
    );

    expect(publishedPayload(DOMAIN_EVENTS.QUOTE_CREATED)?.clientId).toBeNull();
  });

  it('resolveQuoteBySourceDocument scopes lookup to the client and returns the found quote', async () => {
    hoisted.chain.exec.mockResolvedValueOnce(quoteDoc({ sourceDocumentId: 'doc1' }));

    const result = await service.resolveQuoteBySourceDocument({
      sourceDocumentId: '651ab1c2d3e4f506071b0801',
      tenantId: TENANT_ID,
      clientId: CLIENT_ID,
    });

    expect(result).not.toBeNull();
    expect(result?._id).toBe('quote1');
  });
});
