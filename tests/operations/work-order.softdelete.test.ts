import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindOneChain } = vi.hoisted(() => {
  const exec = vi.fn();
  const chain: any = {
    exec,
  };
  return { mockFindOneChain: chain };
});

const hoisted = vi.hoisted(() => ({
  mockFindOne: vi.fn().mockReturnValue(mockFindOneChain),
  mockUpdateOne: vi.fn(),
  mockWorkReportExists: vi.fn(),
  mockEventExists: vi.fn(),
  mockLogActivity: vi.fn(),
}));

vi.mock('@/operations/models', () => ({
  WorkOrderModel: {
    findOne: hoisted.mockFindOne,
    updateOne: hoisted.mockUpdateOne,
  },
  WorkOrderEventModel: {
    exists: hoisted.mockEventExists,
  },
  WorkReportModel: {
    exists: hoisted.mockWorkReportExists,
  },
}));

vi.mock('@/crm/models', () => ({
  ClientModel: {},
  LocationModel: {},
  EquipmentModel: {},
}));

vi.mock('@/audit/activity-logger', () => ({
  logActivity: hoisted.mockLogActivity,
}));

vi.mock('@/infrastructure/events/event-bus', () => ({
  eventBus: { publish: vi.fn() },
}));

import { WorkOrderService, ValidationError } from '@/operations/services/work-order.service';

function mockWorkOrder() {
  hoisted.mockFindOne.mockReturnValue(mockFindOneChain);
  mockFindOneChain.exec.mockResolvedValue({ _id: 'wo1', status: 'draft' });
}

describe('WorkOrderService.softDelete — WorkReport guard swap', () => {
  let service: WorkOrderService;

  beforeEach(() => {
    service = new WorkOrderService();
    vi.clearAllMocks();
  });

  it('blocks deletion when a WorkReport exists for the work order', async () => {
    mockWorkOrder();
    hoisted.mockWorkReportExists.mockResolvedValue({ _id: 'wr1' });

    await expect(
      service.softDelete('wo1', 'tenant1', 'user1'),
    ).rejects.toThrow(ValidationError);
  });

  it('includes WorkReport in the error message when blocking deletion', async () => {
    mockWorkOrder();
    hoisted.mockWorkReportExists.mockResolvedValue({ _id: 'wr1' });

    try {
      await service.softDelete('wo1', 'tenant1', 'user1');
    } catch (e) {
      expect((e as ValidationError).message).toContain('WorkReport');
    }
  });

  it('permits deletion when no WorkReport exists and no events exist', async () => {
    mockWorkOrder();
    hoisted.mockWorkReportExists.mockResolvedValue(null);
    hoisted.mockEventExists.mockResolvedValue(null);
    hoisted.mockUpdateOne.mockResolvedValue({});

    const result = await service.softDelete('wo1', 'tenant1', 'user1');

    expect(result).toBe(true);
    expect(hoisted.mockUpdateOne).toHaveBeenCalled();
  });

  it('checks WorkReportModel.exists with workOrderId and tenantId', async () => {
    mockWorkOrder();
    hoisted.mockWorkReportExists.mockResolvedValue(null);
    hoisted.mockEventExists.mockResolvedValue(null);
    hoisted.mockUpdateOne.mockResolvedValue({});

    await service.softDelete('wo1', 'tenant1', 'user1');

    expect(hoisted.mockWorkReportExists).toHaveBeenCalledWith({
      workOrderId: 'wo1',
      tenantId: 'tenant1',
    });
  });
});
