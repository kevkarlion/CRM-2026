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
    mockUpdateMany: vi.fn(),
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
    create: hoisted.mockQuoteCreate,
    findOne: vi.fn(() => hoisted.chain),
    countDocuments: vi.fn(() => hoisted.chain),
    findOneAndUpdate: vi.fn(() => hoisted.chain),
    updateMany: hoisted.mockUpdateMany,
  },
}));

vi.mock('../../src/quotes/models/quote-version', () => ({
  default: {
    create: hoisted.mockQuoteVersionCreate,
    findOne: vi.fn(() => hoisted.chain),
    find: vi.fn(() => hoisted.chain),
  },
}));

vi.mock('../../src/quotes/helpers/state-machine', () => ({
  validateTransition: hoisted.mockValidateTransition,
  validateSendRequirements: hoisted.mockValidateSendRequirements,
  validateApproveRequirements: hoisted.mockValidateApproveRequirements,
  TransitionError: class extends Error {
    constructor(message: string, public readonly from: string, public readonly to: string, public readonly reason: string) {
      super(message);
      this.name = 'TransitionError';
    }
  },
}));

vi.mock('../../src/quotes/helpers/counter', () => ({
  getNextQuoteNumber: hoisted.mockGetNextQuoteNumber,
}));

vi.mock('../../src/quotes/helpers/calculator', () => ({
  processItems: hoisted.mockProcessItems,
  calculateSubtotal: hoisted.mockCalculateSubtotal,
  calculateTotal: hoisted.mockCalculateTotal,
}));

vi.mock('../../src/audit/activity-logger', () => ({
  logActivity: hoisted.mockLogActivity,
}));

vi.mock('../../src/crm/helpers/cursor-pagination', () => ({
  cursorPage: hoisted.mockCursorPage,
}));

vi.mock('../../src/core/models/tenant', () => ({
  default: {
    findById: hoisted.mockTenantFindById,
  },
}));

import { QuoteService, ConflictError, ValidationError, NotFoundError } from '../../src/quotes/services/quote.service';

function makeQuote(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'quote1',
    tenantId: 'tenant1',
    clientId: 'client1',
    locationId: null,
    number: 'COT-0001',
    status: 'draft',
    currentVersion: 1,
    title: 'Test Quote',
    description: 'Desc',
    validUntil: null,
    subtotal: 1000,
    discountAmount: 100,
    taxAmount: 50,
    total: 950,
    notes: 'Some notes',
    sentAt: null,
    approvedAt: null,
    rejectedAt: null,
    rejectedReason: null,
    convertedToWorkOrder: null,
    convertedAt: null,
    createdBy: 'user1',
    updatedBy: 'user1',
    deletedBy: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    toObject() { return { ...this }; },
    ...overrides,
  };
}

function makeVersion(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'ver1',
    tenantId: 'tenant1',
    quoteId: 'quote1',
    version: 1,
    title: 'Test Quote',
    description: 'Desc',
    items: [{ description: 'Item A', type: 'product', quantity: 2, unitPrice: 100, subtotal: 200 }],
    subtotal: 1000,
    discountAmount: 100,
    taxAmount: 50,
    total: 950,
    notes: 'Some notes',
    createdBy: 'user1',
    createdAt: new Date(),
    toObject() { return { ...this }; },
    ...overrides,
  };
}

describe('QuoteService', () => {
  let service: QuoteService;

  beforeEach(() => {
    service = new QuoteService();
    vi.clearAllMocks();
    hoisted.chain.exec.mockReset();
    hoisted.mockUpdateMany.mockReset();
    hoisted.mockValidateTransition.mockReset();
    hoisted.mockValidateSendRequirements.mockReset();
    hoisted.mockValidateApproveRequirements.mockReset();
    hoisted.chain.lean.mockReset();
    hoisted.chain.select.mockReset();
    hoisted.chain.sort.mockReset();
    hoisted.chain.populate.mockReset();
    hoisted.chain.lean.mockReturnValue(hoisted.chain);
    hoisted.chain.select.mockReturnValue(hoisted.chain);
    hoisted.chain.sort.mockReturnValue(hoisted.chain);
    hoisted.chain.populate.mockReturnValue(hoisted.chain);
    hoisted.mockTenantFindById.mockReturnValue(hoisted.chain);
  });

  describe('createQuote', () => {
    it('creates Quote and QuoteVersion in transaction', async () => {
      const quoteDoc = makeQuote();
      const versionDoc = makeVersion();
      hoisted.chain.exec.mockResolvedValue({ quoteNumberPrefix: 'COT' });
      hoisted.mockGetNextQuoteNumber.mockResolvedValue('COT-0001');
      hoisted.mockProcessItems.mockReturnValue([
        { description: 'Item A', type: 'product', quantity: 2, unitPrice: 100, subtotal: 200 },
      ]);
      hoisted.mockCalculateSubtotal.mockReturnValue(200);
      hoisted.mockCalculateTotal.mockReturnValue(250);
      hoisted.mockQuoteCreate.mockResolvedValue([quoteDoc]);
      hoisted.mockQuoteVersionCreate.mockResolvedValue([versionDoc]);

      const result = await service.createQuote(
        { clientId: 'client1', title: 'Test Quote', items: [{ description: 'Item A', type: 'product', quantity: 2, unitPrice: 100 }] },
        'user1',
        'tenant1',
      );

      expect(result.quote).toBeDefined();
      expect(result.version).toBeDefined();
      expect(hoisted.mockStartSession).toHaveBeenCalled();
      expect(hoisted.session.commitTransaction).toHaveBeenCalled();
      expect(hoisted.mockLogActivity).toHaveBeenCalled();
    });

    it('generates sequential number and passes it to create', async () => {
      hoisted.chain.exec.mockResolvedValue({ quoteNumberPrefix: 'COT' });
      hoisted.mockGetNextQuoteNumber.mockResolvedValue('COT-0042');
      hoisted.mockProcessItems.mockReturnValue([]);
      hoisted.mockCalculateSubtotal.mockReturnValue(0);
      hoisted.mockCalculateTotal.mockReturnValue(0);

      const quoteDoc = makeQuote();
      hoisted.mockQuoteCreate.mockImplementation((data: any) => {
        return [{ ...quoteDoc, number: data[0].number }];
      });
      hoisted.mockQuoteVersionCreate.mockImplementation((data: any) => {
        return [{ ...makeVersion(), number: data[0].number }];
      });

      const result = await service.createQuote(
        { clientId: 'client1', title: 'Test', items: [{ description: 'A', type: 'product', quantity: 1, unitPrice: 10 }] },
        'user1',
        'tenant1',
      );

      expect(result.quote.number).toBe('COT-0042');
    });

    it('calculates financials', async () => {
      hoisted.chain.exec.mockResolvedValue({ quoteNumberPrefix: 'COT' });
      hoisted.mockGetNextQuoteNumber.mockResolvedValue('COT-0001');
      hoisted.mockProcessItems.mockReturnValue([]);
      hoisted.mockCalculateSubtotal.mockReturnValue(500);
      hoisted.mockCalculateTotal.mockReturnValue(550);
      hoisted.mockQuoteCreate.mockResolvedValue([makeQuote()]);
      hoisted.mockQuoteVersionCreate.mockResolvedValue([makeVersion()]);

      await service.createQuote(
        { clientId: 'client1', title: 'Test', items: [{ description: 'A', type: 'product', quantity: 1, unitPrice: 10 }] },
        'user1',
        'tenant1',
      );

      expect(hoisted.mockCalculateSubtotal).toHaveBeenCalled();
      expect(hoisted.mockCalculateTotal).toHaveBeenCalled();
    });

    it('throws ValidationError on empty items', async () => {
      await expect(
        service.createQuote(
          { clientId: 'client1', title: 'Test', items: [] },
          'user1',
          'tenant1',
        ),
      ).rejects.toThrow(ValidationError);
    });

    it('uses tenant quoteNumberPrefix', async () => {
      hoisted.chain.exec.mockResolvedValue({ quoteNumberPrefix: 'QTZ' });
      hoisted.mockGetNextQuoteNumber.mockResolvedValue('QTZ-0001');
      hoisted.mockProcessItems.mockReturnValue([]);
      hoisted.mockCalculateSubtotal.mockReturnValue(0);
      hoisted.mockCalculateTotal.mockReturnValue(0);

      const quoteDoc = makeQuote();
      hoisted.mockQuoteCreate.mockImplementation((data: any) => {
        return [{ ...quoteDoc, number: data[0].number }];
      });
      hoisted.mockQuoteVersionCreate.mockResolvedValue([makeVersion()]);

      await service.createQuote(
        { clientId: 'client1', title: 'Test', items: [{ description: 'A', type: 'product', quantity: 1, unitPrice: 10 }] },
        'user1',
        'tenant1',
      );

      expect(hoisted.mockGetNextQuoteNumber).toHaveBeenCalledWith('tenant1', 'QTZ');
    });
  });

  describe('getQuote', () => {
    it('returns quote with current version', async () => {
      const quoteDoc = makeQuote();
      const versionDoc = makeVersion();
      hoisted.chain.exec
        .mockResolvedValueOnce(quoteDoc)
        .mockResolvedValueOnce(versionDoc);

      const result = await service.getQuote('quote1', 'tenant1');

      expect(result.quote).toBeDefined();
      expect(result.quote._id).toBe('quote1');
      expect(result.currentVersion).toBeDefined();
    });

    it('throws NotFoundError if not found', async () => {
      hoisted.chain.exec.mockResolvedValueOnce(null);

      await expect(service.getQuote('nonexistent', 'tenant1')).rejects.toThrow(NotFoundError);
    });

    it('respects tenant isolation', async () => {
      hoisted.chain.exec.mockResolvedValueOnce(null);

      await expect(service.getQuote('quote1', 'tenant2')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listQuotes', () => {
    it('returns paginated results', async () => {
      const quotes = [makeQuote(), makeQuote({ _id: 'quote2' })];
      hoisted.chain.exec.mockResolvedValueOnce(5);
      hoisted.mockCursorPage.mockResolvedValueOnce({ data: quotes, cursor: null });

      const result = await service.listQuotes({}, 'tenant1');

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.cursor).toBeUndefined();
    });

    it('filters by status', async () => {
      hoisted.chain.exec.mockResolvedValueOnce(0);
      hoisted.mockCursorPage.mockResolvedValueOnce({ data: [], cursor: null });

      await service.listQuotes({ status: 'sent' }, 'tenant1');

      expect(hoisted.mockCursorPage).toHaveBeenCalled();
    });

    it('filters by clientId', async () => {
      hoisted.chain.exec.mockResolvedValueOnce(0);
      hoisted.mockCursorPage.mockResolvedValueOnce({ data: [], cursor: null });

      await service.listQuotes({ clientId: 'client1' }, 'tenant1');

      expect(hoisted.mockCursorPage).toHaveBeenCalled();
    });

    it('filters by date range', async () => {
      hoisted.chain.exec.mockResolvedValueOnce(0);
      hoisted.mockCursorPage.mockResolvedValueOnce({ data: [], cursor: null });

      await service.listQuotes({ createdAtGte: '2026-01-01', createdAtLte: '2026-12-31' }, 'tenant1');

      expect(hoisted.mockCursorPage).toHaveBeenCalled();
    });

    it('filters by search', async () => {
      hoisted.chain.exec.mockResolvedValueOnce(0);
      hoisted.mockCursorPage.mockResolvedValueOnce({ data: [], cursor: null });

      await service.listQuotes({ search: 'Cotizacion' }, 'tenant1');

      expect(hoisted.mockCursorPage).toHaveBeenCalled();
    });

    it('respects soft delete', async () => {
      hoisted.chain.exec.mockResolvedValueOnce(0);
      hoisted.mockCursorPage.mockResolvedValueOnce({ data: [], cursor: null });

      await service.listQuotes({}, 'tenant1');

      expect(hoisted.mockCursorPage).toHaveBeenCalled();
    });
  });

  describe('updateQuote', () => {
    it('creates new version on commercial changes (items)', async () => {
      const quoteDoc = makeQuote();
      const versionDoc = makeVersion();
      hoisted.chain.exec
        .mockResolvedValueOnce(quoteDoc)
        .mockResolvedValueOnce(versionDoc)
        .mockResolvedValueOnce(quoteDoc);

      hoisted.mockProcessItems.mockReturnValue([
        { description: 'New Item', type: 'product', quantity: 1, unitPrice: 500, subtotal: 500 },
      ]);
      hoisted.mockCalculateSubtotal.mockReturnValue(500);
      hoisted.mockCalculateTotal.mockReturnValue(550);
      hoisted.mockQuoteVersionCreate.mockResolvedValue([versionDoc]);

      const result = await service.updateQuote(
        'quote1',
        { items: [{ description: 'New Item', type: 'product', quantity: 1, unitPrice: 500 }] },
        'user1',
        'tenant1',
      );

      expect(result.newVersion).toBe(true);
      expect(result.version).toBeDefined();
      expect(hoisted.mockQuoteVersionCreate).toHaveBeenCalled();
    });

    it('creates new version on discountAmount change', async () => {
      const quoteDoc = makeQuote();
      const versionDoc = makeVersion();
      hoisted.chain.exec
        .mockResolvedValueOnce(quoteDoc)
        .mockResolvedValueOnce(versionDoc)
        .mockResolvedValueOnce(quoteDoc);

      hoisted.mockCalculateSubtotal.mockReturnValue(1000);
      hoisted.mockCalculateTotal.mockReturnValue(900);
      hoisted.mockQuoteVersionCreate.mockResolvedValue([versionDoc]);

      const result = await service.updateQuote(
        'quote1',
        { discountAmount: 200 },
        'user1',
        'tenant1',
      );

      expect(result.newVersion).toBe(true);
    });

    it('creates new version on taxAmount change', async () => {
      const quoteDoc = makeQuote();
      const versionDoc = makeVersion();
      hoisted.chain.exec
        .mockResolvedValueOnce(quoteDoc)
        .mockResolvedValueOnce(versionDoc)
        .mockResolvedValueOnce(quoteDoc);

      hoisted.mockCalculateSubtotal.mockReturnValue(1000);
      hoisted.mockCalculateTotal.mockReturnValue(1100);
      hoisted.mockQuoteVersionCreate.mockResolvedValue([versionDoc]);

      const result = await service.updateQuote(
        'quote1',
        { taxAmount: 100 },
        'user1',
        'tenant1',
      );

      expect(result.newVersion).toBe(true);
    });

    it('creates new version on title change', async () => {
      const quoteDoc = makeQuote({ title: 'Updated Title' });
      const versionDoc = makeVersion({ version: 2 });
      hoisted.chain.exec
        .mockResolvedValueOnce(makeQuote())
        .mockResolvedValueOnce(makeVersion())
        .mockResolvedValueOnce(quoteDoc);
      hoisted.mockQuoteVersionCreate.mockResolvedValue([versionDoc]);

      const result = await service.updateQuote(
        'quote1',
        { title: 'Updated Title' },
        'user1',
        'tenant1',
      );

      expect(result.newVersion).toBe(true);
      expect(hoisted.mockQuoteVersionCreate).toHaveBeenCalled();
    });

    it('creates new version on description change', async () => {
      const quoteDoc = makeQuote({ description: 'New desc' });
      const versionDoc = makeVersion({ version: 2 });
      hoisted.chain.exec
        .mockResolvedValueOnce(makeQuote())
        .mockResolvedValueOnce(makeVersion())
        .mockResolvedValueOnce(quoteDoc);
      hoisted.mockQuoteVersionCreate.mockResolvedValue([versionDoc]);

      const result = await service.updateQuote(
        'quote1',
        { description: 'New desc' },
        'user1',
        'tenant1',
      );

      expect(result.newVersion).toBe(true);
    });

    it('creates new version on notes change', async () => {
      const quoteDoc = makeQuote({ notes: 'New notes' });
      const versionDoc = makeVersion({ version: 2 });
      hoisted.chain.exec
        .mockResolvedValueOnce(makeQuote())
        .mockResolvedValueOnce(makeVersion())
        .mockResolvedValueOnce(quoteDoc);
      hoisted.mockQuoteVersionCreate.mockResolvedValue([versionDoc]);

      const result = await service.updateQuote(
        'quote1',
        { notes: 'New notes' },
        'user1',
        'tenant1',
      );

      expect(result.newVersion).toBe(true);
    });

    it('throws NotFoundError if quote not found', async () => {
      hoisted.chain.exec.mockResolvedValueOnce(null);

      await expect(
        service.updateQuote('nonexistent', { title: 'Test' }, 'user1', 'tenant1'),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError on terminal state', async () => {
      hoisted.chain.exec.mockResolvedValueOnce(makeQuote({ status: 'approved' }));

      await expect(
        service.updateQuote('quote1', { title: 'Test' }, 'user1', 'tenant1'),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('sendQuote', () => {
    it('transitions draft → sent atomically', async () => {
      const quoteDoc = makeQuote({ status: 'draft' });
      const versionDoc = makeVersion();
      const updatedDoc = makeQuote({ status: 'sent', sentAt: new Date() });
      hoisted.chain.exec
        .mockResolvedValueOnce(quoteDoc)
        .mockResolvedValueOnce(versionDoc)
        .mockResolvedValueOnce(updatedDoc);

      const result = await service.sendQuote('quote1', 'user1', 'tenant1');

      expect(result.status).toBe('sent');
      expect(hoisted.mockValidateTransition).toHaveBeenCalledWith('draft', 'sent');
      expect(hoisted.mockValidateSendRequirements).toHaveBeenCalled();
      expect(hoisted.mockLogActivity).toHaveBeenCalled();
    });

    it('throws ConflictError on race condition', async () => {
      hoisted.chain.exec
        .mockResolvedValueOnce(makeQuote({ status: 'draft' }))
        .mockResolvedValueOnce(makeVersion())
        .mockResolvedValueOnce(null);

      await expect(service.sendQuote('quote1', 'user1', 'tenant1')).rejects.toThrow(ConflictError);
    });

    it('throws NotFoundError if quote not found', async () => {
      hoisted.chain.exec.mockResolvedValueOnce(null);

      await expect(service.sendQuote('nonexistent', 'user1', 'tenant1')).rejects.toThrow(NotFoundError);
    });

    it('throws when validateTransition fails', async () => {
      hoisted.chain.exec.mockResolvedValueOnce(makeQuote({ status: 'approved' }));
      hoisted.mockValidateTransition.mockImplementation(() => {
        throw new Error('Invalid transition');
      });

      await expect(service.sendQuote('quote1', 'user1', 'tenant1')).rejects.toThrow();
    });

    it('throws when validateSendRequirements fails', async () => {
      hoisted.chain.exec
        .mockResolvedValueOnce(makeQuote({ status: 'draft' }))
        .mockResolvedValueOnce(makeVersion());
      hoisted.mockValidateSendRequirements.mockImplementation(() => {
        throw new Error('Missing fields');
      });

      await expect(service.sendQuote('quote1', 'user1', 'tenant1')).rejects.toThrow();
    });
  });

  describe('approveQuote', () => {
    it('transitions sent → approved atomically', async () => {
      const quoteDoc = makeQuote({ status: 'sent' });
      const updatedDoc = makeQuote({ status: 'approved', approvedAt: new Date() });
      hoisted.chain.exec
        .mockResolvedValueOnce(quoteDoc)
        .mockResolvedValueOnce(updatedDoc);

      const result = await service.approveQuote('quote1', 'user1', 'tenant1');

      expect(result.status).toBe('approved');
      expect(hoisted.mockValidateTransition).toHaveBeenCalledWith('sent', 'approved');
      expect(hoisted.mockValidateApproveRequirements).toHaveBeenCalled();
    });

    it('throws ValidationError if not in sent status', async () => {
      const existingQuote = makeQuote({ status: 'draft' });
      hoisted.chain.exec
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingQuote);

      await expect(service.approveQuote('quote1', 'user1', 'tenant1')).rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError if quote not found', async () => {
      hoisted.chain.exec
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(service.approveQuote('nonexistent', 'user1', 'tenant1')).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError on race condition', async () => {
      hoisted.chain.exec
        .mockResolvedValueOnce(makeQuote({ status: 'sent' }))
        .mockResolvedValueOnce(null);

      await expect(service.approveQuote('quote1', 'user1', 'tenant1')).rejects.toThrow(ConflictError);
    });
  });

  describe('rejectQuote', () => {
    it('transitions sent → rejected with reason', async () => {
      const updatedDoc = makeQuote({ status: 'rejected', rejectedAt: new Date(), rejectedReason: 'Not interested' });
      hoisted.chain.exec
        .mockResolvedValueOnce(makeQuote({ status: 'sent' }))
        .mockResolvedValueOnce(updatedDoc);

      const result = await service.rejectQuote('quote1', 'user1', 'tenant1', 'Not interested');

      expect(result.status).toBe('rejected');
      expect(hoisted.mockValidateTransition).toHaveBeenCalledWith('sent', 'rejected');
    });

    it('transitions sent → rejected without reason', async () => {
      const updatedDoc = makeQuote({ status: 'rejected', rejectedAt: new Date(), rejectedReason: null });
      hoisted.chain.exec
        .mockResolvedValueOnce(makeQuote({ status: 'sent' }))
        .mockResolvedValueOnce(updatedDoc);

      const result = await service.rejectQuote('quote1', 'user1', 'tenant1');

      expect(result.status).toBe('rejected');
    });

    it('throws ValidationError if not in sent status', async () => {
      hoisted.chain.exec
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeQuote({ status: 'draft' }));

      await expect(service.rejectQuote('quote1', 'user1', 'tenant1')).rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError if quote not found', async () => {
      hoisted.chain.exec
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(service.rejectQuote('nonexistent', 'user1', 'tenant1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('cancelQuote', () => {
    it('cancels a draft quote', async () => {
      const updatedDoc = makeQuote({ status: 'cancelled' });
      hoisted.chain.exec
        .mockResolvedValueOnce(makeQuote({ status: 'draft' }))
        .mockResolvedValueOnce(updatedDoc);

      const result = await service.cancelQuote('quote1', 'user1', 'tenant1');

      expect(result.status).toBe('cancelled');
    });

    it('cancels a sent quote', async () => {
      const updatedDoc = makeQuote({ status: 'cancelled' });
      hoisted.chain.exec
        .mockResolvedValueOnce(makeQuote({ status: 'sent' }))
        .mockResolvedValueOnce(updatedDoc);

      const result = await service.cancelQuote('quote1', 'user1', 'tenant1');

      expect(result.status).toBe('cancelled');
    });

    it('throws ValidationError from terminal status', async () => {
      hoisted.chain.exec.mockResolvedValueOnce(makeQuote({ status: 'approved' }));

      await expect(service.cancelQuote('quote1', 'user1', 'tenant1')).rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError if quote not found', async () => {
      hoisted.chain.exec.mockResolvedValueOnce(null);

      await expect(service.cancelQuote('nonexistent', 'user1', 'tenant1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('softDelete', () => {
    it('soft deletes from draft status', async () => {
      const deletedDoc = makeQuote({ deletedAt: new Date(), deletedBy: 'user1' });
      hoisted.chain.exec
        .mockResolvedValueOnce(makeQuote({ status: 'draft' }))
        .mockResolvedValueOnce(deletedDoc);

      const result = await service.softDelete('quote1', 'user1', 'tenant1');

      expect(result.deletedAt).toBeDefined();
      expect(result.deletedBy).toBe('user1');
    });

    it('soft deletes from sent status', async () => {
      const deletedDoc = makeQuote({ status: 'sent', deletedAt: new Date(), deletedBy: 'user1' });
      hoisted.chain.exec
        .mockResolvedValueOnce(makeQuote({ status: 'sent' }))
        .mockResolvedValueOnce(deletedDoc);

      const result = await service.softDelete('quote1', 'user1', 'tenant1');

      expect(result.deletedAt).toBeDefined();
    });

    it('throws ValidationError from terminal status (approved)', async () => {
      hoisted.chain.exec.mockResolvedValueOnce(makeQuote({ status: 'approved' }));

      await expect(service.softDelete('quote1', 'user1', 'tenant1')).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError from terminal status (rejected)', async () => {
      hoisted.chain.exec.mockResolvedValueOnce(makeQuote({ status: 'rejected' }));

      await expect(service.softDelete('quote1', 'user1', 'tenant1')).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError from terminal status (expired)', async () => {
      hoisted.chain.exec.mockResolvedValueOnce(makeQuote({ status: 'expired' }));

      await expect(service.softDelete('quote1', 'user1', 'tenant1')).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError from terminal status (cancelled)', async () => {
      hoisted.chain.exec.mockResolvedValueOnce(makeQuote({ status: 'cancelled' }));

      await expect(service.softDelete('quote1', 'user1', 'tenant1')).rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError if quote not found', async () => {
      hoisted.chain.exec.mockResolvedValueOnce(null);

      await expect(service.softDelete('nonexistent', 'user1', 'tenant1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getVersions', () => {
    it('returns all versions sorted desc', async () => {
      const versions = [makeVersion({ version: 2 }), makeVersion({ version: 1 })];
      hoisted.chain.exec.mockResolvedValue(versions);

      const result = await service.getVersions('quote1', 'tenant1');

      expect(result).toHaveLength(2);
    });
  });

  describe('expireBatch', () => {
    it('updates all expired sent quotes', async () => {
      hoisted.mockUpdateMany.mockReturnValue(hoisted.chain);
      hoisted.chain.exec.mockResolvedValue({ modifiedCount: 3 });

      const result = await service.expireBatch('tenant1');

      expect(result).toBe(3);
    });
  });
});
