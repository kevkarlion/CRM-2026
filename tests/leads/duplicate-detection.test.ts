import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryChain } = vi.hoisted(() => {
  const exec = vi.fn();
  const chain: any = { lean: vi.fn(), exec };
  chain.lean.mockReturnValue(chain);
  return { mockQueryChain: chain };
});

vi.mock('mongoose', () => {
  class MockObjectId {
    constructor(_id?: string) {}
  }
  return {
    Types: { ObjectId: MockObjectId as any },
    Schema: class {},
    model: vi.fn(),
    Document: class {},
    default: { Types: { ObjectId: MockObjectId as any } },
  };
});

vi.mock('../../src/leads/models', () => ({
  LeadModel: {
    find: vi.fn().mockReturnValue(mockQueryChain),
  },
}));

import { findDuplicates } from '../../src/leads/helpers/duplicate-detection';
import { LeadModel } from '../../src/leads/models';

describe('Duplicate Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findDuplicates', () => {
    it('finds duplicate by email', async () => {
      const existingLead = { _id: 'lead1', email: 'duplicate@example.com' };
      mockQueryChain.exec.mockResolvedValue([existingLead]);

      const result = await findDuplicates('tenant1', 'duplicate@example.com');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(existingLead);
    });

    it('finds duplicate by phone', async () => {
      const existingLead = { _id: 'lead1', phone: '5491112345678' };
      mockQueryChain.exec.mockResolvedValue([existingLead]);

      const result = await findDuplicates('tenant1', undefined, '5491112345678');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(existingLead);
    });

    it('finds duplicate by companyName', async () => {
      const existingLead = { _id: 'lead1', companyName: 'ACME Inc' };
      mockQueryChain.exec.mockResolvedValue([existingLead]);

      const result = await findDuplicates('tenant1', undefined, undefined, 'ACME Inc');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(existingLead);
    });

    it('returns empty array when no duplicate found', async () => {
      mockQueryChain.exec.mockResolvedValue([]);

      const result = await findDuplicates('tenant1', 'unique@example.com');

      expect(result).toHaveLength(0);
    });

    it('returns empty array when no search criteria provided', async () => {
      const result = await findDuplicates('tenant1');

      expect(result).toHaveLength(0);
      expect(mockQueryChain.exec).not.toHaveBeenCalled();
    });

    it('matches multiple criteria combined', async () => {
      const dup1 = { _id: 'lead1', email: 'same@example.com' };
      const dup2 = { _id: 'lead2', companyName: 'Same Corp' };
      mockQueryChain.exec.mockResolvedValue([dup1, dup2]);

      const result = await findDuplicates('tenant1', 'same@example.com', undefined, 'Same Corp');

      expect(result).toHaveLength(2);
    });

    it('is case insensitive for email', async () => {
      mockQueryChain.exec.mockResolvedValue([{ _id: 'lead1', email: 'Match@Example.COM' }]);

      const result = await findDuplicates('tenant1', 'match@example.com');

      expect(result).toHaveLength(1);
      const call = (LeadModel.find as any).mock.calls[0][0];
      const emailCond = call.$or.find((c: any) => c.email);
      expect(emailCond.email.$regex.flags).toContain('i');
    });

    it('is case insensitive for companyName', async () => {
      mockQueryChain.exec.mockResolvedValue([{ _id: 'lead1', companyName: 'ACME CORP' }]);

      const result = await findDuplicates('tenant1', undefined, undefined, 'acme corp');

      expect(result).toHaveLength(1);
      const call = (LeadModel.find as any).mock.calls[0][0];
      const companyCond = call.$or.find((c: any) => c.companyName);
      expect(companyCond.companyName.$regex.flags).toContain('i');
    });

    it('always filters by tenantId and excludes deleted', async () => {
      mockQueryChain.exec.mockResolvedValue([]);

      await findDuplicates('tenant-abc', 'test@example.com');

      const query = (LeadModel.find as any).mock.calls[0][0];
      expect(query.tenantId).toBe('tenant-abc');
      expect(query.deletedAt).toBeNull();
    });
  });
});
