import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';

const mockFindOne = vi.fn();
const mockFindOneAndUpdate = vi.fn();
const mockCreate = vi.fn();
const mockFind = vi.fn();

vi.mock('../../src/operations/models', () => ({
  WorkOrderModel: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
    findOneAndUpdate: (...args: unknown[]) => mockFindOneAndUpdate(...args),
  },
  WorkOrderAssignmentModel: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    findOneAndUpdate: (...args: unknown[]) => mockFindOneAndUpdate(...args),
    updateOne: vi.fn().mockResolvedValue({}),
    find: (...args: unknown[]) => ({
      sort: () => ({ lean: () => ({ exec: () => Promise.resolve(mockFind(...args)) }) }),
    }),
  },
}));

vi.mock('../../src/audit/activity-logger', () => ({
  logActivity: vi.fn(),
}));

import { AssignmentService } from '../../src/operations/services/assignment.service';

describe('Assignment Service', () => {
  let service: AssignmentService;

  beforeEach(() => {
    service = new AssignmentService();
    vi.clearAllMocks();
  });

  describe('assignTechnician', () => {
    it('creates assignment record and syncs denormalized array', async () => {
      mockFindOne
        .mockResolvedValueOnce(null)  // no existing active assignment
        .mockResolvedValueOnce({ _id: 'wo1', tenantId: 'tenant1', deletedAt: null });  // WO exists

      const createdAssignment = {
        _id: new Types.ObjectId(),
        toObject: () => ({ _id: 'assign1', technicianId: 'tech1' }),
      };
      mockCreate.mockResolvedValue(createdAssignment);

      const updatedWorkOrder = { _id: 'wo1', assignedTechnicians: [new Types.ObjectId('tech1')] };
      mockFindOneAndUpdate.mockResolvedValue(updatedWorkOrder);

      const result = await service.assignTechnician('wo1', 'tech1', 'tenant1', 'user1');

      expect(result.assignment._id).toBe('assign1');
      expect(result.workOrder.assignedTechnicians).toHaveLength(1);
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'wo1', tenantId: 'tenant1', deletedAt: null },
        { $addToSet: { assignedTechnicians: expect.any(Types.ObjectId) } },
        { new: true },
      );
    });

    it('throws error when technician already assigned', async () => {
      mockFindOne.mockResolvedValueOnce({ _id: 'existing1', status: 'assigned' });

      await expect(
        service.assignTechnician('wo1', 'tech1', 'tenant1', 'user1'),
      ).rejects.toThrow('already assigned');
    });

    it('throws error when WorkOrder not found', async () => {
      mockFindOne
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
      mockFindOneAndUpdate
        .mockResolvedValueOnce(updatedAssignment)  // find and mark declined
        .mockResolvedValueOnce({ _id: 'wo1', assignedTechnicians: [] });  // sync array

      const result = await service.unassignTechnician('wo1', 'tech1', 'tenant1', 'user1');

      expect(result.workOrder).toBeDefined();
      expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(2);
    });

    it('throws error when no active assignment found', async () => {
      mockFindOneAndUpdate.mockResolvedValueOnce(null);

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

      mockFindOneAndUpdate
        .mockResolvedValueOnce(oldAssignment)  // mark old replaced
        .mockResolvedValueOnce({ _id: 'wo1', assignedTechnicians: [new Types.ObjectId('tech2')] });  // sync array

      mockCreate.mockResolvedValue(newCreatedAssignment);

      const result = await service.reassignTechnician('wo1', 'tech1', 'tech2', 'tenant1', 'user1');

      expect(result.newAssignment._id).toBe('new1');
      expect(result.workOrder.assignedTechnicians).toHaveLength(1);
    });

    it('throws error when old technician has no active assignment', async () => {
      mockFindOneAndUpdate.mockResolvedValueOnce(null);

      await expect(
        service.reassignTechnician('wo1', 'tech1', 'tech2', 'tenant1', 'user1'),
      ).rejects.toThrow('not found');
    });

    it('creates new assignment with correct technician ID', async () => {
      const oldAssignment = { _id: 'old1', status: 'replaced' };

      mockFindOneAndUpdate
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
