import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const exec = vi.fn();
  const chain: any = {
    lean: vi.fn(),
    select: vi.fn(),
    sort: vi.fn(),
    populate: vi.fn(),
    exec,
  };
  chain.lean.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);
  chain.populate.mockReturnValue(chain);

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
    mockQuoteFindOne: vi.fn(() => chain),
    mockQuoteVersionFindOne: vi.fn(() => chain),
    mockGetNextWorkOrderNumber: vi.fn(),
    mockWorkOrderCreate: vi.fn(),
    mockClientFindById: vi.fn(() => chain),
    mockLocationFindById: vi.fn(() => chain),
    mockLogActivity: vi.fn(),
    mockQuoteSave: vi.fn(),
  };
});

vi.mock('mongoose', () => {
  class MockObjectId {
    constructor(_id?: string) {}
    toString() { return 'mock-id'; }
  }
  return {
    Types: { ObjectId: MockObjectId as any },
    Schema: class {
      static Types = { ObjectId: MockObjectId };
      index(...args: any[]) { return this; }
    },
    model: vi.fn(),
    Document: class {},
    startSession: hoisted.mockStartSession,
    default: {
      Types: { ObjectId: MockObjectId as any },
      Schema: class {
        static Types = { ObjectId: MockObjectId };
        index(...args: any[]) { return this; }
      },
      model: vi.fn(),
      startSession: hoisted.mockStartSession,
    },
  };
});

vi.mock('../../src/quotes/models/quote', () => ({
  default: {
    findOne: hoisted.mockQuoteFindOne,
  },
}));

vi.mock('../../src/quotes/models/quote-version', () => ({
  default: {
    findOne: hoisted.mockQuoteVersionFindOne,
  },
}));

vi.mock('../../src/crm/models/client', () => ({
  default: {
    findById: hoisted.mockClientFindById,
  },
}));

vi.mock('../../src/crm/models/location', () => ({
  default: {
    findById: hoisted.mockLocationFindById,
  },
}));

vi.mock('../../src/operations/helpers/counter', () => ({
  getNextWorkOrderNumber: hoisted.mockGetNextWorkOrderNumber,
}));

vi.mock('../../src/operations/models', () => ({
  WorkOrderModel: {
    create: hoisted.mockWorkOrderCreate,
  },
}));

vi.mock('../../src/audit/activity-logger', () => ({
  logActivity: hoisted.mockLogActivity,
}));

import { ConversionService, ConversionError } from '../../src/quotes/services/conversion.service';

function makeQuote(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'quote1',
    tenantId: { toString() { return 'tenant1'; } },
    clientId: { toString() { return 'client1'; } },
    locationId: { toString() { return 'loc1'; } },
    number: 'COT-0001',
    status: 'approved',
    currentVersion: 1,
    title: 'Test Quote',
    validUntil: null,
    subtotal: 1000,
    discountAmount: 0,
    taxAmount: 0,
    total: 1000,
    convertedToWorkOrder: null,
    convertedAt: null,
    updatedBy: null,
    toObject() { return { ...this }; },
    save: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'client1',
    fullName: 'Juan Pérez',
    companyName: 'ACME',
    email: 'juan@test.com',
    phone: '+5491112345678',
    taxId: '30-12345678-9',
    customerType: 'business',
    status: 'active',
    toObject() { return { ...this }; },
    ...overrides,
  };
}

function makeLocation(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'loc1',
    name: 'Main Office',
    address: 'Av. Siempre Viva 123',
    city: 'Buenos Aires',
    province: 'CABA',
    country: 'Argentina',
    postalCode: 'C1000',
    toObject() { return { ...this }; },
    ...overrides,
  };
}

describe('ConversionService', () => {
  let service: ConversionService;

  beforeEach(() => {
    service = new ConversionService();
    vi.clearAllMocks();
  });

  describe('convertToWorkOrder', () => {
    it('validates quote exists', async () => {
      hoisted.chain.exec
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        service.convertToWorkOrder('nonexistent', 'user1', 'tenant1'),
      ).rejects.toThrow(ConversionError);
    });

    it('throws ConversionError if quote is not approved', async () => {
      const draftQuote = makeQuote({ status: 'draft' });
      hoisted.chain.exec
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...draftQuote, lean: () => ({ exec: vi.fn().mockResolvedValue(draftQuote) }) });

      await expect(
        service.convertToWorkOrder('quote1', 'user1', 'tenant1'),
      ).rejects.toThrow(ConversionError);
    });

    it('throws ConversionError if already converted', async () => {
      const convertedQuote = makeQuote({ convertedToWorkOrder: 'wo1' });
      hoisted.chain.exec.mockResolvedValueOnce(convertedQuote);

      await expect(
        service.convertToWorkOrder('quote1', 'user1', 'tenant1'),
      ).rejects.toThrow(ConversionError);
    });

    it('creates WorkOrder in transaction with snapshots', async () => {
      const quoteDoc = makeQuote();
      const versionDoc = {
        title: 'Test Quote',
        description: 'Desc',
        items: [],
        subtotal: 1000,
      };
      const clientDoc = makeClient();
      const locationDoc = makeLocation();
      const woDoc = { _id: 'wo1', toObject() { return { _id: 'wo1' }; } };

      hoisted.chain.exec
        .mockResolvedValueOnce(quoteDoc)
        .mockResolvedValueOnce(versionDoc)
        .mockResolvedValueOnce(clientDoc)
        .mockResolvedValueOnce(locationDoc);

      hoisted.mockGetNextWorkOrderNumber.mockResolvedValue('WO-0001');
      hoisted.mockWorkOrderCreate.mockResolvedValue([woDoc]);

      const result = await service.convertToWorkOrder('quote1', 'user1', 'tenant1');

      expect(result.quote).toBeDefined();
      expect(result.workOrder).toBeDefined();
      expect(quoteDoc.convertedToWorkOrder).toBe('wo1');
      expect(quoteDoc.convertedAt).toBeDefined();
      expect(quoteDoc.save).toHaveBeenCalledWith({ session: hoisted.session });
      expect(hoisted.session.commitTransaction).toHaveBeenCalled();
      expect(hoisted.mockLogActivity).toHaveBeenCalled();
    });

    it('respects tenant isolation', async () => {
      hoisted.chain.exec
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        service.convertToWorkOrder('quote1', 'user1', 'tenant2'),
      ).rejects.toThrow(ConversionError);
    });
  });
});
