import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';

vi.mock('../../src/operations/models', () => ({
  WorkOrderModel: {
    findOneAndUpdate: vi.fn(),
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

      vi.mocked(WorkOrderModel.findOneAndUpdate).mockResolvedValue(mockUpdated as any);

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
      vi.mocked(WorkOrderModel.findOneAndUpdate).mockResolvedValue(null);
      vi.mocked(WorkOrderModel.exists).mockResolvedValue(null);

      const result = await service.update('nonexistent', { title: 'Nope' }, 'tenant1', 'user1', 0);

      expect(result).toBeNull();
    });

    it('throws ConflictError (409) when version is stale', async () => {
      vi.mocked(WorkOrderModel.findOneAndUpdate).mockResolvedValue(null);
      vi.mocked(WorkOrderModel.exists).mockResolvedValue({} as any);

      await expect(
        service.update('abc123', { title: 'Stale' }, 'tenant1', 'user1', 0),
      ).rejects.toThrow(ConflictError);
    });

    it('throws ConflictError with descriptive message on stale version', async () => {
      vi.mocked(WorkOrderModel.findOneAndUpdate).mockResolvedValue(null);
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

      vi.mocked(WorkOrderModel.findOne).mockResolvedValue(currentDoc as any);
      vi.mocked(WorkOrderModel.findOneAndUpdate).mockResolvedValue(updatedDoc as any);

      const result = await service.changeStatus(
        'abc123', 'scheduled', { hasSchedule: true }, 'tenant1', 'user1', 0,
      );

      expect(result).toBeDefined();
      expect(result!.version).toBe(1);
    });

    it('throws ConflictError when version is stale during status change', async () => {
      const currentDoc = { _id: 'abc123', status: 'draft', version: 0 };

      vi.mocked(WorkOrderModel.findOne).mockResolvedValue(currentDoc as any);
      vi.mocked(WorkOrderModel.findOneAndUpdate).mockResolvedValue(null);

      await expect(
        service.changeStatus('abc123', 'scheduled', { hasSchedule: true }, 'tenant1', 'user1', 5),
      ).rejects.toThrow(ConflictError);
    });
  });
});
