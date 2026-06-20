import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { Types } from 'mongoose';

const mockCreate = vi.fn();
const mockFind = vi.fn();

vi.mock('../../src/operations/models', () => ({
  WorkOrderModel: {
    findOne: vi.fn().mockReturnValue(mockQueryChain),
    findOneAndUpdate: vi.fn().mockReturnValue(mockQueryChain),
  },
  WorkOrderAssignmentModel: {
    findOne: vi.fn().mockReturnValue(mockQueryChain),
    create: (...args: unknown[]) => mockCreate(...args),
    findOneAndUpdate: vi.fn().mockReturnValue(mockQueryChain),
    updateOne: vi.fn().mockResolvedValue({}),
    find: (...args: unknown[]) => ({
      sort: () => ({ lean: () => ({ exec: () => Promise.resolve(mockFind(...args)) }) }),
    }),
  },
}));

vi.mock('../../src/audit/activity-logger', () => ({
  logActivity: vi.fn(),
}));

import { WorkOrderModel, WorkOrderAssignmentModel } from '../../src/operations/models';
import { AssignmentService } from '../../src/operations/services/assignment.service';

describe('Assignment Service', () => {
  let service: AssignmentService;

  beforeEach(() => {
    service = new AssignmentService();
    vi.clearAllMocks();
  });

  describe('assignTechnician', () => {
    it('creates assignment record and syncs denormalized array', async () => {
      mockQueryChain.exec
        .mockResolvedValueOnce(null)  // no existing active assignment
        .mockResolvedValueOnce({ _id: 'wo1', tenantId: 'tenant1', deletedAt: null });  // WO exists

      const createdAssignment = {
        _id: new Types.ObjectId(),
        toObject: () => ({ _id: 'assign1', technicianId: 'tech1' }),
      };
      mockCreate.mockResolvedValue(createdAssignment);

      const updatedWorkOrder = { _id: 'wo1', assignedTechnicians: [new Types.ObjectId('tech1')] };
      mockQueryChain.exec.mockResolvedValue(updatedWorkOrder);

      const result = await service.assignTechnician('wo1', 'tech1', 'tenant1', 'user1');

      expect(result.assignment._id).toBe('assign1');
      expect(result.workOrder.assignedTechnicians).toHaveLength(1);
      expect(WorkOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'wo1', tenantId: 'tenant1', deletedAt: null },
        { $addToSet: { assignedTechnicians: expect.any(Types.ObjectId) } },
        { new: true },
      );
    });

    it('throws error when technician already assigned', async () => {
      mockQueryChain.exec.mockResolvedValueOnce({ _id: 'existing1', status: 'assigned' });

      await expect(
        service.assignTechnician('wo1', 'tech1', 'tenant1', 'user1'),
      ).rejects.toThrow('already assigned');
    });

    it('throws error when WorkOrder not found', async () => {
      mockQueryChain.exec
        .mockResolvedValueOnce(null)  // no existing assignment
        .mockResolvedValueOnce(null);  // WO not found

      await expect(
        service.assignTechnician('wo1', 'tech1', 'tenant1', 'user1'),
      ).rejects.toThrow('not found');
    });
  });

  describe('unassignTechnician', () => {
    it('marks assignment as declined and syncs array', async () => {
      const updatedAssignment = {
        _id: 'assign1',
        status: 'declined',
        declinedAt: new Date(),
      };
      mockQueryChain.exec
        .mockResolvedValueOnce(updatedAssignment)  // find and mark declined
        .mockResolvedValueOnce({ _id: 'wo1', assignedTechnicians: [] });  // sync array

      const result = await service.unassignTechnician('wo1', 'tech1', 'tenant1', 'user1');

      expect(result.workOrder).toBeDefined();
      expect(WorkOrderAssignmentModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(WorkOrderModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('throws error when no active assignment found', async () => {
      mockQueryChain.exec.mockResolvedValueOnce(null);

      await expect(
        service.unassignTechnician('wo1', 'tech1', 'tenant1', 'user1'),
      ).rejects.toThrow('not found');
    });
  });

  describe('reassignTechnician', () => {
    it('marks old as replaced, creates new, syncs array', async () => {
      const oldAssignment = { _id: 'old1', status: 'replaced', replacedAt: new Date() };
      const newCreatedAssignment = {
        _id: new Types.ObjectId(),
        toObject: () => ({ _id: 'new1', technicianId: 'tech2' }),
      };

      mockQueryChain.exec
        .mockResolvedValueOnce(oldAssignment)  // mark old replaced
        .mockResolvedValueOnce({ _id: 'wo1', assignedTechnicians: [new Types.ObjectId('tech2')] });  // sync array

      mockCreate.mockResolvedValue(newCreatedAssignment);

      const result = await service.reassignTechnician('wo1', 'tech1', 'tech2', 'tenant1', 'user1');

      expect(result.newAssignment._id).toBe('new1');
      expect(result.workOrder.assignedTechnicians).toHaveLength(1);
    });

    it('throws error when old technician has no active assignment', async () => {
      mockQueryChain.exec.mockResolvedValueOnce(null);

      await expect(
        service.reassignTechnician('wo1', 'tech1', 'tech2', 'tenant1', 'user1'),
      ).rejects.toThrow('not found');
    });

    it('creates new assignment with correct technician ID', async () => {
      const oldAssignment = { _id: 'old1', status: 'replaced' };

      mockQueryChain.exec
        .mockResolvedValueOnce(oldAssignment)
        .mockResolvedValueOnce({ _id: 'wo1', assignedTechnicians: [new Types.ObjectId('tech2')] });

      const newCreatedAssignment = {
        _id: new Types.ObjectId(),
        toObject: () => ({ _id: 'new1', technicianId: 'tech2' }),
      };
      mockCreate.mockResolvedValue(newCreatedAssignment);

      await service.reassignTechnician('wo1', 'tech1', 'tech2', 'tenant1', 'user1');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          technicianId: expect.any(Types.ObjectId),
          workOrderId: expect.any(Types.ObjectId),
        }),
      );
    });
  });
});
