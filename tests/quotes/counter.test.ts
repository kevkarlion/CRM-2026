import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindOneAndUpdate = vi.hoisted(() => vi.fn());

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
    model: vi.fn(() => ({
      findOneAndUpdate: mockFindOneAndUpdate,
    })),
    Document: class {},
    default: {
      Types: { ObjectId: MockObjectId as any },
      Schema: class {
        static Types = { ObjectId: MockObjectId };
        index(...args: any[]) { return this; }
      },
      model: vi.fn(() => ({
        findOneAndUpdate: mockFindOneAndUpdate,
      })),
    },
  };
});

import { getNextQuoteNumber } from '../../src/quotes/helpers/counter';

describe('Quote Counter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNextQuoteNumber', () => {
    it('returns formatted number with default prefix COT', async () => {
      mockFindOneAndUpdate.mockResolvedValue({ seq: 5 });
      const result = await getNextQuoteNumber('tenant1');
      expect(result).toBe('COT-0005');
    });

    it('uses custom prefix when provided', async () => {
      mockFindOneAndUpdate.mockResolvedValue({ seq: 1 });
      const result = await getNextQuoteNumber('tenant1', 'PRE');
      expect(result).toBe('PRE-0001');
    });

    it('pads sequence to 4 digits', async () => {
      mockFindOneAndUpdate.mockResolvedValue({ seq: 123 });
      const result = await getNextQuoteNumber('tenant1');
      expect(result).toBe('COT-0123');
    });

    it('handles large sequence numbers', async () => {
      mockFindOneAndUpdate.mockResolvedValue({ seq: 9999 });
      const result = await getNextQuoteNumber('tenant1');
      expect(result).toBe('COT-9999');
    });

    it('calls findOneAndUpdate with upsert', async () => {
      mockFindOneAndUpdate.mockResolvedValue({ seq: 1 });
      await getNextQuoteNumber('tenant-x', 'QT');
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'QT-tenant-x' },
        { $inc: { seq: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    });
  });
});
