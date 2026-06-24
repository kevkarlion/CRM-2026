import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContractService } from '../../src/contracts/services/contract.service';

const hoisted = vi.hoisted(() => {
  const chain: any = {
    lean: vi.fn(),
    select: vi.fn(),
    sort: vi.fn(),
    populate: vi.fn(),
    exec: vi.fn(),
    toObject: vi.fn(),
  };
  chain.lean.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);
  chain.populate.mockReturnValue(chain);

  const findOneAndUpdateChain: any = {
    lean: vi.fn(),
    select: vi.fn(),
    exec: vi.fn(),
  };
  findOneAndUpdateChain.lean.mockReturnValue(findOneAndUpdateChain);
  findOneAndUpdateChain.select.mockReturnValue(findOneAndUpdateChain);

  return {
    chain,
    findOneAndUpdateChain,
    mockContractCreate: vi.fn(),
    mockFindOne: vi.fn().mockReturnValue(chain),
    mockFind: vi.fn().mockReturnValue(chain),
    mockFindOneAndUpdate: vi.fn().mockReturnValue(findOneAndUpdateChain),
    mockUpdateOne: vi.fn(),
    mockUpdateMany: vi.fn(),
    mockClientFindById: vi.fn(),
    mockLogActivity: vi.fn(),
    mockEquipmentCreate: vi.fn(),
    mockEquipmentFindOne: vi.fn(),
    mockEquipmentFind: vi.fn(),
  };
});

vi.mock('../../src/contracts/models', () => ({
  ContractModel: {
    create: hoisted.mockContractCreate,
    findOne: hoisted.mockFindOne,
    find: hoisted.mockFind,
    findOneAndUpdate: hoisted.mockFindOneAndUpdate,
    updateOne: hoisted.mockUpdateOne,
    updateMany: hoisted.mockUpdateMany,
  },
  ContractEquipmentModel: {
    create: hoisted.mockEquipmentCreate,
    findOne: hoisted.mockEquipmentFindOne,
    find: hoisted.mockEquipmentFind,
    updateOne: hoisted.mockUpdateOne,
  },
  MaintenancePlanModel: {},
  MaintenanceScheduleModel: {},
}));

vi.mock('../../src/crm/models', () => ({
  ClientModel: {
    findById: hoisted.mockClientFindById,
  },
  LocationModel: {},
  EquipmentModel: {},
}));

vi.mock('../../src/audit/activity-logger', () => ({
  logActivity: hoisted.mockLogActivity,
}));

describe('ContractService', () => {
  let service: ContractService;
  const tenantId = 'tenant-1';
  const userId = 'user-1';
  const mockClient = { _id: 'client-1', fullName: 'Test Client', email: 'test@test.com', phone: '123' };
  const mockContract = {
    _id: 'contract-1',
    tenantId,
    clientId: 'client-1',
    name: 'Test Contract',
    status: 'draft',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    frequency: { interval: 1, unit: 'months' },
    clientSnapshot: { name: 'Test Client' },
    toObject: hoisted.chain.toObject,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ContractService();
    hoisted.chain.toObject.mockReturnValue(mockContract);
    hoisted.mockFindOne.mockReturnValue(hoisted.chain);
    hoisted.mockFindOneAndUpdate.mockReturnValue(hoisted.findOneAndUpdateChain);
  });

  describe('create', () => {
    it('creates a contract with client snapshot', async () => {
      hoisted.mockClientFindById.mockReturnValue(hoisted.chain);
      hoisted.chain.exec.mockResolvedValue(mockClient);
      hoisted.mockContractCreate.mockResolvedValue(hoisted.chain);

      const result = await service.create(
        {
          clientId: 'client-1' as any,
          name: 'Test Contract',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          frequency: { interval: 1, unit: 'months' },
        },
        userId,
        tenantId,
      );

      expect(result).toEqual(mockContract);
      expect(hoisted.mockContractCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          name: 'Test Contract',
          status: 'draft',
          clientSnapshot: expect.objectContaining({ name: 'Test Client' }),
        }),
      );
      expect(hoisted.mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'contract', action: 'created' }),
      );
    });

    it('throws when client not found', async () => {
      hoisted.mockClientFindById.mockReturnValue(hoisted.chain);
      hoisted.chain.exec.mockResolvedValue(null);

      await expect(
        service.create(
          {
            clientId: 'invalid' as any,
            name: 'Test',
            startDate: new Date(),
            endDate: new Date(),
            frequency: { interval: 1, unit: 'months' },
          },
          userId,
          tenantId,
        ),
      ).rejects.toThrow('Client invalid not found');
    });
  });

  describe('changeStatus', () => {
    it('activates a draft contract', async () => {
      hoisted.chain.exec.mockResolvedValueOnce({ status: 'draft', _id: 'contract-1' }); // current
      hoisted.findOneAndUpdateChain.exec.mockResolvedValue({ status: 'active', _id: 'contract-1' }); // updated

      const result = await service.changeStatus('contract-1', 'active', tenantId, userId);

      expect(result).toEqual({ status: 'active', _id: 'contract-1' });
      expect(hoisted.mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'activated' }),
      );
    });

    it('throws on invalid transition draft → cancelled', async () => {
      hoisted.chain.exec.mockResolvedValue({ status: 'draft', _id: 'contract-1' });

      await expect(
        service.changeStatus('contract-1', 'cancelled', tenantId, userId),
      ).rejects.toThrow('Cannot transition from draft to cancelled');
    });
  });

  describe('softDelete', () => {
    it('deletes a draft contract', async () => {
      hoisted.mockFindOne.mockReturnValue(hoisted.chain);
      hoisted.chain.exec.mockResolvedValue({ _id: 'contract-1', status: 'draft' });

      const result = await service.softDelete('contract-1', tenantId, userId);
      expect(result).toBe(true);
      expect(hoisted.mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'deleted' }),
      );
    });

    it('rejects deleting an active contract', async () => {
      hoisted.mockFindOne.mockReturnValue(hoisted.chain);
      hoisted.chain.exec.mockResolvedValue({ _id: 'contract-1', status: 'active' });

      await expect(
        service.softDelete('contract-1', tenantId, userId),
      ).rejects.toThrow("Cannot delete contract in status 'active'");
    });
  });

  describe('equipment management', () => {
    it('adds equipment to contract', async () => {
      hoisted.mockFindOne.mockReturnValue(hoisted.chain);
      hoisted.chain.exec.mockResolvedValueOnce(mockContract); // contract exists
      hoisted.mockEquipmentFindOne.mockReturnValue(hoisted.chain);
      hoisted.chain.exec.mockResolvedValueOnce(null); // no existing assignment

      await service.addEquipment('contract-1', 'equip-1', tenantId);

      expect(hoisted.mockEquipmentCreate).toHaveBeenCalled();
      expect(hoisted.mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'equipment_added' }),
      );
    });

    it('prevents duplicate equipment', async () => {
      hoisted.mockFindOne.mockReturnValue(hoisted.chain);
      hoisted.chain.exec.mockResolvedValueOnce(mockContract);
      hoisted.mockEquipmentFindOne.mockReturnValue(hoisted.chain);
      hoisted.chain.exec.mockResolvedValueOnce({ _id: 'existing', equipmentId: 'equip-1' });

      await expect(
        service.addEquipment('contract-1', 'equip-1', tenantId),
      ).rejects.toThrow('Equipment is already assigned');
    });
  });
});
