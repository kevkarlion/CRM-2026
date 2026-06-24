import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MaintenancePlanService } from '../../src/contracts/services/maintenance-plan.service';

const hoisted = vi.hoisted(() => {
  const chain: any = {
    lean: vi.fn(),
    select: vi.fn(),
    sort: vi.fn(),
    exec: vi.fn(),
    toObject: vi.fn(),
  };
  chain.lean.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);

  const mockPlanObject = {
    _id: 'plan-1',
    contractId: 'contract-1',
    name: 'Monthly Check',
    interval: 1,
    unit: 'monthly' as const,
    active: true,
    toObject: function () { return this; },
  };

  return {
    chain,
    mockPlanObject,
    mockPlanCreate: vi.fn().mockResolvedValue(mockPlanObject),
    mockContractFindOne: vi.fn().mockReturnValue(chain),
    mockPlanFindOne: vi.fn().mockReturnValue(chain),
    mockPlanFind: vi.fn().mockReturnValue(chain),
    mockFindOneAndUpdate: vi.fn(),
    mockScheduleCreate: vi.fn(),
    mockScheduleFindOne: vi.fn(),
    mockLogActivity: vi.fn(),
  };
});

vi.mock('../../src/contracts/models', () => ({
  ContractModel: {
    findOne: hoisted.mockContractFindOne,
  },
  MaintenancePlanModel: {
    create: hoisted.mockPlanCreate,
    findOne: hoisted.mockPlanFindOne,
    find: hoisted.mockPlanFind,
    findOneAndUpdate: hoisted.mockFindOneAndUpdate,
  },
  MaintenanceScheduleModel: {
    create: hoisted.mockScheduleCreate,
    findOne: hoisted.mockScheduleFindOne,
  },
}));

vi.mock('../../src/audit/activity-logger', () => ({
  logActivity: hoisted.mockLogActivity,
}));

describe('MaintenancePlanService', () => {
  let service: MaintenancePlanService;
  const tenantId = 'tenant-1';
  const userId = 'user-1';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MaintenancePlanService();
    hoisted.mockContractFindOne.mockReturnValue(hoisted.chain);
    hoisted.mockPlanFind.mockReturnValue(hoisted.chain);
    hoisted.mockPlanFindOne.mockReturnValue(hoisted.chain);
    hoisted.mockScheduleFindOne.mockReturnValue(hoisted.chain);
  });

  describe('create', () => {
    it('creates a plan under an existing contract', async () => {
      hoisted.chain.exec.mockResolvedValueOnce({ _id: 'contract-1', status: 'draft' });

      const result = await service.create(
        'contract-1',
        { name: 'Monthly Check', interval: 1, unit: 'monthly' },
        userId,
        tenantId,
      );

      expect(result.name).toBe('Monthly Check');
      expect(result.active).toBe(true);
      expect(hoisted.mockPlanCreate).toHaveBeenCalledWith(
        expect.objectContaining({ contractId: 'contract-1', active: true }),
      );
    });

    it('throws when contract not found', async () => {
      hoisted.chain.exec.mockResolvedValue(null);

      await expect(
        service.create('invalid', { name: 'Test', interval: 1, unit: 'monthly' }, userId, tenantId),
      ).rejects.toThrow('Contract not found');
    });
  });

  describe('generateSchedules', () => {
    it('generates schedules for active contract with active plans', async () => {
      hoisted.chain.exec
        .mockResolvedValueOnce({
          _id: 'contract-1',
          status: 'active',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-03-31'),
        })
        .mockResolvedValueOnce([
          { _id: 'plan-1', interval: 1, unit: 'monthly', name: 'Monthly' },
        ]);

      // Schedule duplicate checks - chain.exec is shared, subsequent calls return default undefined
      // which is falsy, so "existing" will be null, and schedules get created

      const count = await service.generateSchedules('contract-1', tenantId, userId);

      expect(count).toBeGreaterThanOrEqual(3);
    });

    it('throws for draft contract', async () => {
      hoisted.chain.exec.mockResolvedValue({ _id: 'contract-1', status: 'draft' });

      await expect(
        service.generateSchedules('contract-1', tenantId, userId),
      ).rejects.toThrow('Cannot generate schedules for a non-active contract');
    });
  });
});
