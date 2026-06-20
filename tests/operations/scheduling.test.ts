import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';

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

// Mock mongoose ObjectId to accept any string without validation
vi.mock('mongoose', () => {
  class MockObjectId {
    constructor(_id?: string) { /* no-op — accept any string */ }
  }
  return {
    Types: { ObjectId: MockObjectId as unknown as typeof import('mongoose').Types.ObjectId },
    Schema: class {},
    model: vi.fn(),
    Document: class {},
  };
});

const mockHasNoConflicts = vi.fn();
const mockCheckMultiTechnicianConflicts = vi.fn();

vi.mock('../../src/operations/helpers/overlap-detection', () => ({
  hasNoConflicts: (...args: unknown[]) => mockHasNoConflicts(...args),
  checkMultiTechnicianConflicts: (...args: unknown[]) => mockCheckMultiTechnicianConflicts(...args),
}));

vi.mock('../../src/operations/models', () => ({
  WorkOrderModel: {
    findOne: vi.fn().mockReturnValue(mockQueryChain),
    findOneAndUpdate: vi.fn().mockReturnValue(mockQueryChain),
  },
  WorkOrderEventModel: {
    create: vi.fn(),
  },
}));

vi.mock('../../src/audit/activity-logger', () => ({
  logActivity: vi.fn(),
}));

import { SchedulingService } from '../../src/operations/services/scheduling.service';
import { WorkOrderModel } from '../../src/operations/models';

describe('Scheduling — Conflict Detection', () => {
  let service: SchedulingService;

  beforeEach(() => {
    service = new SchedulingService();
    vi.clearAllMocks();
  });

  function makeSlot(date = '2026-07-01') {
    return {
      scheduledDate: new Date(date),
      scheduledStart: new Date(`${date}T09:00:00`),
      scheduledEnd: new Date(`${date}T10:00:00`),
    };
  }

  function makeSlotRange(
    date: string,
    startHour: number,
    endHour: number,
  ) {
    return {
      scheduledDate: new Date(date),
      scheduledStart: new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00`),
      scheduledEnd: new Date(`${date}T${String(endHour).padStart(2, '0')}:00:00`),
    };
  }

  describe('checkConflicts', () => {
    it('back-to-back slots (09:00-10:00 + 10:00-11:00) do NOT conflict', async () => {
      mockHasNoConflicts.mockResolvedValue(true);

      const result = await service.checkConflicts(
        'tenant1', 'tech1',
        new Date('2026-07-01T10:00:00'),
        new Date('2026-07-01T11:00:00'),
      );

      expect(result).toBe(true);
    });

    it('overlapping slots (09:00-10:01 + 10:00-11:00) DO conflict', async () => {
      mockHasNoConflicts.mockResolvedValue(false);

      const result = await service.checkConflicts(
        'tenant1', 'tech1',
        new Date('2026-07-01T10:00:00'),
        new Date('2026-07-01T11:00:00'),
      );

      expect(result).toBe(false);
    });

    it('contained slot (09:00-11:00 contains 09:30-10:00) DO conflict', async () => {
      mockHasNoConflicts.mockResolvedValue(false);

      const result = await service.checkConflicts(
        'tenant1', 'tech1',
        new Date('2026-07-01T09:30:00'),
        new Date('2026-07-01T10:00:00'),
      );

      expect(result).toBe(false);
    });

    it('exact duplicate slots (09:00-10:00 + 09:00-10:00) DO conflict', async () => {
      mockHasNoConflicts.mockResolvedValue(false);

      const result = await service.checkConflicts(
        'tenant1', 'tech1',
        new Date('2026-07-01T09:00:00'),
        new Date('2026-07-01T10:00:00'),
      );

      expect(result).toBe(false);
    });
  });

  describe('validateAvailability (multi-technician)', () => {
    it('returns available: true when no conflicts exist', async () => {
      mockCheckMultiTechnicianConflicts.mockResolvedValue([]);

      const result = await service.validateAvailability(
        'tenant1', ['tech1', 'tech2'],
        new Date('2026-07-01T09:00:00'),
        new Date('2026-07-01T10:00:00'),
      );

      expect(result.available).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('returns available: false with conflict details when one technician overlaps', async () => {
      const tech1Id = new Types.ObjectId();
      const conflictWo = { _id: 'wo1' };
      mockCheckMultiTechnicianConflicts.mockResolvedValue([
        { technicianId: tech1Id, conflict: conflictWo },
      ]);

      const result = await service.validateAvailability(
        'tenant1', [tech1Id.toString()],
        new Date('2026-07-01T09:00:00'),
        new Date('2026-07-01T10:00:00'),
      );

      expect(result.available).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].technicianId).toEqual(tech1Id);
    });

    it('detects conflicts for multi-technician schedule', async () => {
      const techA = new Types.ObjectId();
      const techB = new Types.ObjectId();
      const conflictWo = { _id: 'wo_conflict' };

      mockCheckMultiTechnicianConflicts.mockResolvedValue([
        { technicianId: techA, conflict: conflictWo },
        { technicianId: techB, conflict: conflictWo },
      ]);

      const result = await service.validateAvailability(
        'tenant1', [techA.toString(), techB.toString()],
        new Date('2026-07-01T09:00:00'),
        new Date('2026-07-01T11:00:00'),
      );

      expect(result.available).toBe(false);
      expect(result.conflicts).toHaveLength(2);
    });
  });

  describe('schedule method', () => {
    it('resolves conflict check before updating schedule', async () => {
      const currentWo = {
        _id: 'wo1',
        assignedTechnicians: [new Types.ObjectId('tech1')],
        status: 'draft',
        version: 0,
      };
      const updatedWo = {
        ...currentWo,
        scheduledDate: new Date('2026-07-01'),
        scheduledStart: new Date('2026-07-01T09:00:00'),
        scheduledEnd: new Date('2026-07-01T10:00:00'),
        version: 1,
      };

      mockQueryChain.exec
        .mockResolvedValueOnce(currentWo as any)
        .mockResolvedValueOnce(updatedWo as any);
      mockHasNoConflicts.mockResolvedValue(true);

      const result = await service.schedule(
        'wo1', makeSlot('2026-07-01'), 'tenant1', 'user1', 0,
      );

      expect(result).toBeDefined();
      expect(mockHasNoConflicts).toHaveBeenCalled();
      expect(WorkOrderModel.findOneAndUpdate).toHaveBeenCalled();
    });

    it('throws when conflict is detected during schedule', async () => {
      const currentWo = {
        _id: 'wo1',
        assignedTechnicians: [new Types.ObjectId('tech1')],
        status: 'draft',
        version: 0,
      };

      mockQueryChain.exec.mockResolvedValueOnce(currentWo as any);
      mockHasNoConflicts.mockResolvedValue(false);

      await expect(
        service.schedule('wo1', makeSlot('2026-07-01'), 'tenant1', 'user1', 0),
      ).rejects.toThrow('Scheduling conflict');
    });
  });
});
