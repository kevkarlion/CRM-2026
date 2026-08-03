import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Types } from 'mongoose';
import WorkOrderModel from '@/operations/models/work-order';
import WorkOrderAssignmentModel from '@/operations/models/work-order-assignment';
import { TechnicianModel } from '@/operations/models/technician';
import { eventBus } from '@/infrastructure/events/event-bus';
import { DOMAIN_EVENTS } from '@/infrastructure/events/event.types';
import { WorkAssignmentService } from '@/operations/services/work-assignment.service';

vi.mock('@/operations/models/work-order-assignment', () => ({
  default: { findOne: vi.fn(), create: vi.fn(), findByIdAndUpdate: vi.fn(), findById: vi.fn() },
}));
vi.mock('@/operations/models/work-order', () => ({
  default: { findOne: vi.fn(), findByIdAndUpdate: vi.fn(), updateOne: vi.fn(), findById: vi.fn() },
}));
vi.mock('@/operations/models/technician', () => ({
  TechnicianModel: { findOne: vi.fn(), findById: vi.fn() },
}));
vi.mock('@/infrastructure/events/event-bus', () => ({
  eventBus: { publish: vi.fn().mockResolvedValue(undefined) },
}));

const TENANT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const WO_ID = 'cccccccccccccccccccccccc';
const LEAD_ID = 'dddddddddddddddddddddddd';
const TECH_A = 'eeeeeeeeeeeeeeeeeeeeeeee';
const TECH_B = 'ffffffffffffffffffffffff';
const ASSIGN_A = '111111111111111111111111';
const ASSIGN_B = '222222222222222222222222';

const WO_DOC = {
  _id: WO_ID,
  workOrderNumber: 'WO-0001',
  title: 'Instalación',
  leadId: new Types.ObjectId(LEAD_ID),
  status: 'scheduled',
  tenantId: TENANT_ID,
};

function leanChain(value: unknown) {
  const chain: any = { populate: vi.fn(), lean: vi.fn() };
  chain.populate.mockReturnValue(chain);
  chain.lean.mockResolvedValue(value);
  return chain;
}

describe('Assignment Service', () => {
  let service: WorkAssignmentService;

  beforeEach(() => {
    service = new WorkAssignmentService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockTechnicianLookup() {
    (TechnicianModel.findOne as any).mockReturnValue(leanChain({ _id: TECH_A, name: 'Tech A' }));
    (TechnicianModel.findById as any).mockImplementation((id: string) => ({
      lean: vi.fn().mockResolvedValue(
        id === TECH_B ? { _id: TECH_B, name: 'Tech B' } : { _id: TECH_A, name: 'Tech A' },
      ),
    }));
  }

  function mockCreateAssignmentBase() {
    (WorkOrderModel.findOne as any).mockResolvedValue(WO_DOC);
    mockTechnicianLookup();
    (WorkOrderAssignmentModel.findOne as any).mockResolvedValue(null);
    (WorkOrderAssignmentModel.create as any).mockResolvedValue({
      _id: ASSIGN_A,
      toObject: () => ({ _id: ASSIGN_A, technicianId: TECH_A }),
    });
    (WorkOrderAssignmentModel.findByIdAndUpdate as any).mockResolvedValue({});
    (WorkOrderAssignmentModel.findById as any).mockReturnValue({
      populate: vi.fn().mockResolvedValue({ _id: ASSIGN_A, status: 'assigned' }),
    });
    (WorkOrderModel.findByIdAndUpdate as any).mockResolvedValue({ _id: WO_ID, assignedTechnicians: [TECH_A], status: 'assigned' });
    (WorkOrderModel.updateOne as any).mockResolvedValue({ modifiedCount: 1 });
  }

  describe('createAssignment', () => {
    it('creates the assignment, syncs the denormalized array and promotes scheduled/confirmed only', async () => {
      mockCreateAssignmentBase();

      const result = await service.createAssignment(WO_ID, TECH_A, USER_ID, TENANT_ID, {
        assignmentType: 'manual',
        reason: 'other',
      });

      expect(result._id).toBe(ASSIGN_A);
      expect(WorkOrderAssignmentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          technicianId: expect.any(Types.ObjectId),
          workOrderId: expect.any(Types.ObjectId),
          status: 'assigned',
        }),
      );

      const woWrite = (WorkOrderModel.findByIdAndUpdate as any).mock.calls[0][1];
      expect(woWrite.$set.assignedTechnicians).toHaveLength(1);
      expect(woWrite.$set.status).toBeUndefined();

      expect(WorkOrderModel.updateOne).toHaveBeenCalledWith(
        {
          _id: expect.any(Object),
          tenantId: expect.any(Object),
          status: { $in: ['scheduled', 'confirmed'] },
        },
        { $set: { status: 'assigned' } },
      );
    });

    it('publishes WORK_ORDER_TECHNICIAN_ASSIGNED after persist with full payload', async () => {
      mockCreateAssignmentBase();

      await service.createAssignment(WO_ID, TECH_A, USER_ID, TENANT_ID, {
        assignmentType: 'manual',
        reason: 'availability',
      });

      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DOMAIN_EVENTS.WORK_ORDER_TECHNICIAN_ASSIGNED,
          aggregateType: 'WorkOrder',
          payload: expect.objectContaining({
            workOrderId: WO_ID,
            number: 'WO-0001',
            leadId: LEAD_ID,
            technicianId: TECH_A,
            technicianName: 'Tech A',
            previousTechnicianId: null,
            assignmentType: 'manual',
            reason: 'availability',
            fromStatus: 'scheduled',
            toStatus: 'assigned',
          }),
        }),
      );
    });

    it('is a no-op when the same technician is already active (no write, no event)', async () => {
      mockCreateAssignmentBase();
      const active = { _id: ASSIGN_A, technicianId: new Types.ObjectId(TECH_A), status: 'assigned' };
      (WorkOrderAssignmentModel.findOne as any).mockResolvedValue(active);

      const result = await service.createAssignment(WO_ID, TECH_A, USER_ID, TENANT_ID, {
        assignmentType: 'manual',
        reason: 'other',
      });

      expect(result).toBe(active);
      expect(WorkOrderAssignmentModel.create).not.toHaveBeenCalled();
      expect(WorkOrderAssignmentModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(WorkOrderModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('rejects when a different technician is active and the type is not replacement/redistribution', async () => {
      mockCreateAssignmentBase();
      (WorkOrderAssignmentModel.findOne as any).mockResolvedValue({
        _id: ASSIGN_A,
        technicianId: new Types.ObjectId(TECH_B),
        status: 'assigned',
      });

      await expect(
        service.createAssignment(WO_ID, TECH_A, USER_ID, TENANT_ID, {
          assignmentType: 'manual',
          reason: 'other',
        }),
      ).rejects.toThrow('Ya existe un técnico asignado');

      expect(WorkOrderAssignmentModel.create).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('derives previousTechnicianId from the replaced active assignment (never client value)', async () => {
      mockCreateAssignmentBase();
      (WorkOrderAssignmentModel.findOne as any)
        .mockResolvedValueOnce({ _id: ASSIGN_A, technicianId: new Types.ObjectId(TECH_B), status: 'assigned' })
        .mockResolvedValueOnce(null);

      await service.createAssignment(WO_ID, TECH_A, USER_ID, TENANT_ID, {
        assignmentType: 'replacement',
        reason: 'replacement',
        previousTechnicianId: TECH_A,
      });

      expect(WorkOrderAssignmentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          previousTechnicianId: new Types.ObjectId(TECH_B),
        }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DOMAIN_EVENTS.WORK_ORDER_TECHNICIAN_CHANGED,
          payload: expect.objectContaining({
            technicianId: TECH_A,
            previousTechnicianId: TECH_B,
            previousTechnicianName: 'Tech B',
          }),
        }),
      );
    });

    it('marks the old active assignment as replaced BEFORE creating the new one', async () => {
      mockCreateAssignmentBase();
      (WorkOrderAssignmentModel.findOne as any)
        .mockResolvedValueOnce({ _id: ASSIGN_A, technicianId: new Types.ObjectId(TECH_B), status: 'assigned' })
        .mockResolvedValueOnce(null);

      await service.createAssignment(WO_ID, TECH_A, USER_ID, TENANT_ID, {
        assignmentType: 'replacement',
        reason: 'replacement',
      });

      const replacedOrder = (WorkOrderAssignmentModel.findByIdAndUpdate as any).mock.invocationCallOrder[0];
      const createOrder = (WorkOrderAssignmentModel.create as any).mock.invocationCallOrder[0];
      expect(replacedOrder).toBeLessThan(createOrder);
      expect(WorkOrderAssignmentModel.findByIdAndUpdate).toHaveBeenCalledWith(
        ASSIGN_A,
        expect.objectContaining({ $set: expect.objectContaining({ status: 'replaced', replacedAt: expect.any(Date) }) }),
      );
    });

    it('does not publish ASSIGNED/CHANGED for auto_assignment or redistribution', async () => {
      mockCreateAssignmentBase();

      await service.createAssignment(WO_ID, TECH_A, USER_ID, TENANT_ID, {
        assignmentType: 'auto_assignment',
        reason: 'self-assign',
      });

      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('reactivates a previously assigned technician and still promotes status', async () => {
      mockCreateAssignmentBase();
      const previous = { _id: ASSIGN_A, status: 'replaced' };
      (WorkOrderAssignmentModel.findOne as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(previous);

      await service.createAssignment(WO_ID, TECH_A, USER_ID, TENANT_ID, {
        assignmentType: 'manual',
        reason: 'other',
      });

      expect(WorkOrderAssignmentModel.findByIdAndUpdate).toHaveBeenCalledWith(
        ASSIGN_A,
        expect.objectContaining({ $set: expect.objectContaining({ status: 'assigned' }) }),
      );
      expect(WorkOrderModel.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ status: { $in: ['scheduled', 'confirmed'] } }),
        { $set: { status: 'assigned' } },
      );
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('unassignTechnician', () => {
    function mockUnassign({
      woStatus = 'assigned',
      remainingAfterPull = 0,
    }: { woStatus?: string; remainingAfterPull?: number } = {}) {
      (WorkOrderAssignmentModel.findOne as any).mockReturnValue(
        leanChain({ _id: ASSIGN_A, technicianId: new Types.ObjectId(TECH_A), status: 'assigned' }),
      );
      (WorkOrderAssignmentModel.findByIdAndUpdate as any).mockResolvedValue({});
      (WorkOrderModel.findOne as any).mockReturnValue(
        leanChain({ _id: WO_ID, workOrderNumber: 'WO-0001', leadId: new Types.ObjectId(LEAD_ID), status: woStatus }),
      );
      const remaining = Array.from({ length: remainingAfterPull }, () => new Types.ObjectId());
      (WorkOrderModel.findByIdAndUpdate as any).mockResolvedValue({
        _id: WO_ID,
        status: woStatus,
        assignedTechnicians: remaining,
      });
      (WorkOrderModel.updateOne as any).mockResolvedValue({ modifiedCount: 1 });
      mockTechnicianLookup();
    }

    it('marks the active assignment declined, downgrades to confirmed and publishes UNASSIGNED', async () => {
      mockUnassign({ woStatus: 'assigned' });

      const result = await service.unassignTechnician(WO_ID, TECH_A, TENANT_ID, USER_ID);

      expect(WorkOrderAssignmentModel.findByIdAndUpdate).toHaveBeenCalledWith(
        ASSIGN_A,
        expect.objectContaining({ $set: expect.objectContaining({ status: 'declined', declinedAt: expect.any(Date) }) }),
      );
      expect(WorkOrderModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: expect.any(Object), tenantId: expect.any(Object), deletedAt: null }),
        { $pull: { assignedTechnicians: TECH_A } },
        { new: true },
      );
      expect(WorkOrderModel.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ status: { $in: ['scheduled', 'assigned'] } }),
        { $set: { status: 'confirmed' } },
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DOMAIN_EVENTS.WORK_ORDER_TECHNICIAN_UNASSIGNED,
          payload: expect.objectContaining({
            workOrderId: WO_ID,
            number: 'WO-0001',
            leadId: LEAD_ID,
            technicianId: TECH_A,
            technicianName: 'Tech A',
            fromStatus: 'assigned',
            toStatus: 'confirmed',
          }),
        }),
      );
      expect(result.assignment._id).toBe(ASSIGN_A);
    });

    it('keeps advanced statuses untouched and publishes fromStatus without downgrade', async () => {
      mockUnassign({ woStatus: 'in_progress' });

      await service.unassignTechnician(WO_ID, TECH_A, TENANT_ID, USER_ID);

      expect(WorkOrderModel.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ status: { $in: ['scheduled', 'assigned'] } }),
        { $set: { status: 'confirmed' } },
      );
      const publishedPayload = (eventBus.publish as any).mock.calls[0][0].payload;
      expect(publishedPayload.fromStatus).toBe('in_progress');
      expect(publishedPayload.toStatus).toBeUndefined();
    });

    it('rejects when there is no active assignment (no writes, no event)', async () => {
      mockUnassign();
      (WorkOrderAssignmentModel.findOne as any).mockReturnValue(leanChain(null));

      await expect(service.unassignTechnician(WO_ID, TECH_A, TENANT_ID, USER_ID)).rejects.toThrow('not found');

      expect(WorkOrderAssignmentModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(WorkOrderModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(WorkOrderModel.updateOne).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('rejects when the active assignment belongs to a different technician (no writes, no event)', async () => {
      mockUnassign();
      (WorkOrderAssignmentModel.findOne as any).mockReturnValue(
        leanChain({ _id: ASSIGN_A, technicianId: new Types.ObjectId(TECH_B), status: 'assigned' }),
      );

      await expect(service.unassignTechnician(WO_ID, TECH_A, TENANT_ID, USER_ID)).rejects.toThrow('different technician');

      expect(WorkOrderAssignmentModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('replaceTechnician', () => {
    it('replaces the active technician and publishes WORK_ORDER_TECHNICIAN_CHANGED', async () => {
      (WorkOrderModel.findOne as any).mockResolvedValue(WO_DOC);
      mockTechnicianLookup();
      (WorkOrderAssignmentModel.findOne as any)
        .mockResolvedValueOnce({ _id: ASSIGN_A, technicianId: new Types.ObjectId(TECH_B), status: 'assigned' })
        .mockResolvedValueOnce(null);
      (WorkOrderAssignmentModel.create as any).mockResolvedValue({
        _id: ASSIGN_B,
        toObject: () => ({ _id: ASSIGN_B, technicianId: TECH_A }),
      });
      (WorkOrderAssignmentModel.findByIdAndUpdate as any).mockResolvedValue({});
      (WorkOrderAssignmentModel.findById as any).mockReturnValue({
        populate: vi.fn().mockResolvedValue({ _id: ASSIGN_B, status: 'assigned' }),
      });
      (WorkOrderModel.findByIdAndUpdate as any).mockResolvedValue({ _id: WO_ID, assignedTechnicians: [TECH_A] });
      (WorkOrderModel.updateOne as any).mockResolvedValue({});
      vi.spyOn(service, 'getCurrentAssignment').mockResolvedValue({
        _id: ASSIGN_A,
        technicianId: new Types.ObjectId(TECH_B),
      });

      const result = await service.replaceTechnician(WO_ID, TECH_A, USER_ID, TENANT_ID, 'replacement');

      expect(result._id).toBe(ASSIGN_B);
      expect(WorkOrderAssignmentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          technicianId: expect.any(Types.ObjectId),
          workOrderId: expect.any(Types.ObjectId),
          previousTechnicianId: new Types.ObjectId(TECH_B),
        }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DOMAIN_EVENTS.WORK_ORDER_TECHNICIAN_CHANGED,
          payload: expect.objectContaining({ previousTechnicianId: TECH_B }),
        }),
      );
    });

    it('is a no-op when replacing with the same technician', async () => {
      vi.spyOn(service, 'getCurrentAssignment').mockResolvedValue({
        _id: ASSIGN_A,
        technicianId: new Types.ObjectId(TECH_A),
      });

      const result = await service.replaceTechnician(WO_ID, TECH_A, USER_ID, TENANT_ID, 'replacement');

      expect(result.message).toContain('already assigned');
      expect(WorkOrderAssignmentModel.create).not.toHaveBeenCalled();
    });
  });
});
