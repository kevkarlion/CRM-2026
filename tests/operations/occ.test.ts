import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock mongoose ObjectId to accept any string without validation
vi.mock('mongoose', () => {
  class MockObjectId {
    constructor(_id?: string) { /* no-op — accept any string */ }
  }
  class MockSchema {
    static Types = { ObjectId: MockObjectId as unknown as typeof import('mongoose').Types.ObjectId };
    index = vi.fn().mockReturnThis();
    plugin = vi.fn().mockReturnThis();
    pre = vi.fn().mockReturnThis();
    post = vi.fn().mockReturnThis();
    virtual = vi.fn().mockReturnThis();
    add = vi.fn().mockReturnThis();
  }
  const mockMongoose = {
    Types: { ObjectId: MockObjectId as unknown as typeof import('mongoose').Types.ObjectId },
    Schema: MockSchema as unknown as typeof import('mongoose').Schema,
    model: vi.fn(),
    Document: class {},
  };
  return { ...mockMongoose, default: mockMongoose };
});

const { mockQueryChain } = vi.hoisted(() => {
  const exec = vi.fn();
  const chain: any = {
    lean: vi.fn(),
    select: vi.fn(),
    sort: vi.fn(),
    exec,
  };
  chain.lean.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);
  return { mockQueryChain: chain };
});

vi.mock('../../src/operations/models', () => ({
  WorkOrderModel: {
    findOneAndUpdate: vi.fn().mockReturnValue(mockQueryChain),
    findOne: vi.fn().mockReturnValue(mockQueryChain),
    exists: vi.fn(),
  },
  WorkOrderEventModel: {
    create: vi.fn(),
  },
  VisitReportModel: {
    exists: vi.fn(),
  },
}));

vi.mock('../../src/audit/activity-logger', () => ({
  logActivity: vi.fn(),
}));

import { Types } from 'mongoose';
import { WorkOrderService, ConflictError } from '../../src/operations/services/work-order.service';
import { WorkOrderModel } from '../../src/operations/models';

describe('Optimistic Concurrency Control (OCC)', () => {
  let service: WorkOrderService;

  beforeEach(() => {
    service = new WorkOrderService();
    vi.clearAllMocks();
  });

  describe('update with OCC', () => {
    it('succeeds when version matches and increments version', async () => {
      const mockUpdated = {
        _id: 'abc123',
        version: 1,
        title: 'Updated WO',
      };

      mockQueryChain.exec.mockResolvedValue(mockUpdated as any);

      const result = await service.update('abc123', { title: 'Updated WO' }, 'tenant1', 'user1', 0);

      expect(result).toBeDefined();
      expect(result!.version).toBe(1);
      expect(WorkOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'abc123', tenantId: 'tenant1', deletedAt: null, version: 0 },
        { $set: { title: 'Updated WO', updatedBy: 'user1' }, $inc: { version: 1 } },
        { new: true },
      );
    });

    it('returns null when WorkOrder does not exist', async () => {
      mockQueryChain.exec.mockResolvedValue(null);
      vi.mocked(WorkOrderModel.exists).mockResolvedValue(null);

      const result = await service.update('nonexistent', { title: 'Nope' }, 'tenant1', 'user1', 0);

      expect(result).toBeNull();
    });

    it('throws ConflictError (409) when version is stale', async () => {
      mockQueryChain.exec.mockResolvedValue(null);
      vi.mocked(WorkOrderModel.exists).mockResolvedValue({} as any);

      await expect(
        service.update('abc123', { title: 'Stale' }, 'tenant1', 'user1', 0),
      ).rejects.toThrow(ConflictError);
    });

    it('throws ConflictError with descriptive message on stale version', async () => {
      mockQueryChain.exec.mockResolvedValue(null);
      vi.mocked(WorkOrderModel.exists).mockResolvedValue({} as any);

      try {
        await service.update('abc123', { title: 'Stale' }, 'tenant1', 'user1', 0);
      } catch (e) {
        expect(e).toBeInstanceOf(ConflictError);
        expect((e as ConflictError).message).toContain('modified by another user');
      }
    });
  });

  describe('changeStatus with OCC', () => {
    it('succeeds when version matches current document', async () => {
      const currentDoc = { _id: 'abc123', status: 'draft', version: 0 };
      const updatedDoc = { _id: 'abc123', status: 'scheduled', version: 1 };

      mockQueryChain.exec
        .mockResolvedValueOnce(currentDoc as any)
        .mockResolvedValueOnce(updatedDoc as any);

      const result = await service.changeStatus(
        'abc123', 'scheduled', { hasSchedule: true }, 'tenant1', 'user1', 0,
      );

      expect(result).toBeDefined();
      expect(result!.version).toBe(1);
    });

    it('throws ConflictError when version is stale during status change', async () => {
      const currentDoc = { _id: 'abc123', status: 'draft', version: 0 };

      mockQueryChain.exec
        .mockResolvedValueOnce(currentDoc as any)
        .mockResolvedValueOnce(null);

      await expect(
        service.changeStatus('abc123', 'scheduled', { hasSchedule: true }, 'tenant1', 'user1', 5),
      ).rejects.toThrow(ConflictError);
    });
  });
});
