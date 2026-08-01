import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/core/db', () => ({ connectDB: vi.fn() }));
vi.mock('@/audit/activity-logger', () => ({ logActivity: vi.fn() }));
vi.mock('@/rbac/api-helpers', () => ({ requireAssignPermission: vi.fn() }));

vi.mock('@/operations/models/work-order-assignment', () => ({
  default: { findOne: vi.fn(), create: vi.fn(), findByIdAndUpdate: vi.fn(), findById: vi.fn() },
}));
vi.mock('@/operations/models/work-order', () => ({
  default: { findOne: vi.fn(), findByIdAndUpdate: vi.fn(), updateOne: vi.fn() },
}));
vi.mock('@/operations/models/technician', () => ({
  TechnicianModel: { findOne: vi.fn(), findById: vi.fn() },
}));
vi.mock('@/operations/models/technical-visit', () => ({
  TechnicalVisitModel: { updateOne: vi.fn(), findOneAndUpdate: vi.fn() },
}));

import WorkOrderModel from '@/operations/models/work-order';
import WorkOrderAssignmentModel from '@/operations/models/work-order-assignment';
import { TechnicianModel } from '@/operations/models/technician';
import { TechnicalVisitModel } from '@/operations/models/technical-visit';
import { workAssignmentService } from '@/operations/services/work-assignment.service';
import { technicalVisitService } from '@/operations/services/technical-visit.service';
import { requireAssignPermission } from '@/rbac/api-helpers';
import { POST as AssignPOST } from '@/app/api/operations/work-orders/[id]/assign/route';

const TENANT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const WO_ID = 'cccccccccccccccccccccccc';
const TECH_ID = 'dddddddddddddddddddddddd';
const VISIT_ID = 'eeeeeeeeeeeeeeeeeeeeeeee';

function mockBaseModels() {
  (WorkOrderModel.findOne as any).mockResolvedValue({
    _id: WO_ID,
    workOrderNumber: 'WO-0001',
    tenantId: TENANT_ID,
  });
  (TechnicianModel.findOne as any).mockResolvedValue({ _id: TECH_ID });
  (WorkOrderAssignmentModel.findOne as any).mockResolvedValue(null);
  (WorkOrderAssignmentModel.create as any).mockResolvedValue({ _id: WO_ID });
  (WorkOrderModel.findByIdAndUpdate as any).mockResolvedValue({});
  (WorkOrderModel.updateOne as any).mockResolvedValue({});
  (TechnicianModel.findById as any).mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
}

// Stateful mock: WorkOrderModel.updateOne only applies the status change when the
// current status matches the guarded filter, mirroring the real conditional update.
function mockStatefulStatusModel(initialStatus: string) {
  let status = initialStatus;
  (WorkOrderModel.findOne as any).mockResolvedValue({
    _id: WO_ID,
    workOrderNumber: 'WO-0001',
    tenantId: TENANT_ID,
  });
  (TechnicianModel.findOne as any).mockResolvedValue({ _id: TECH_ID });
  (WorkOrderAssignmentModel.findOne as any).mockResolvedValue(null);
  (WorkOrderAssignmentModel.create as any).mockResolvedValue({ _id: WO_ID });
  (WorkOrderModel.findByIdAndUpdate as any).mockResolvedValue({});
  (TechnicianModel.findById as any).mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
  (WorkOrderModel.updateOne as any).mockImplementation((filter: any, update: any) => {
    const allowed = filter.status?.$in;
    if (Array.isArray(allowed) && allowed.includes(status)) {
      status = update.$set.status;
    }
    return { modifiedCount: 1 };
  });
  return { getStatus: () => status };
}

describe('workAssignmentService.createAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBaseModels();
  });

  it('promotes status to assigned via a scheduled/confirmed-only filter (never downgrades)', async () => {
    await workAssignmentService.createAssignment(WO_ID, TECH_ID, USER_ID, TENANT_ID, {
      assignmentType: 'manual',
      reason: 'other',
    });

    expect(WorkOrderModel.updateOne).toHaveBeenCalledWith(
      {
        _id: expect.any(Object),
        tenantId: expect.any(Object),
        status: { $in: ['scheduled', 'confirmed'] },
      },
      { $set: { status: 'assigned' } },
    );
  });

  it('promotes status to assigned also on the re-assignment (previous assignment) path', async () => {
    const previous = { _id: WO_ID, status: 'replaced' };
    (WorkOrderAssignmentModel.findOne as any)
      .mockResolvedValueOnce(previous)
      .mockResolvedValueOnce(previous);
    (WorkOrderAssignmentModel.findByIdAndUpdate as any).mockResolvedValue({});
    (WorkOrderAssignmentModel.findById as any).mockReturnValue({
      populate: vi.fn().mockResolvedValue({}),
    });

    await workAssignmentService.createAssignment(WO_ID, TECH_ID, USER_ID, TENANT_ID, {
      assignmentType: 'auto_assignment',
      reason: 'self-assign',
    });

    expect(WorkOrderModel.updateOne).toHaveBeenCalledWith(
      {
        _id: expect.any(Object),
        tenantId: expect.any(Object),
        status: { $in: ['scheduled', 'confirmed'] },
      },
      { $set: { status: 'assigned' } },
    );
  });

  it('promotes a scheduled WO to assigned when a technician is assigned', async () => {
    const state = mockStatefulStatusModel('scheduled');
    await workAssignmentService.createAssignment(WO_ID, TECH_ID, USER_ID, TENANT_ID, {
      assignmentType: 'manual',
      reason: 'other',
    });
    expect(state.getStatus()).toBe('assigned');
  });

  it('promotes a confirmed WO to assigned when a technician is assigned', async () => {
    const state = mockStatefulStatusModel('confirmed');
    await workAssignmentService.createAssignment(WO_ID, TECH_ID, USER_ID, TENANT_ID, {
      assignmentType: 'manual',
      reason: 'other',
    });
    expect(state.getStatus()).toBe('assigned');
  });

  it('does NOT overwrite an advanced status (in_progress) when a technician is assigned', async () => {
    const state = mockStatefulStatusModel('in_progress');
    await workAssignmentService.createAssignment(WO_ID, TECH_ID, USER_ID, TENANT_ID, {
      assignmentType: 'manual',
      reason: 'other',
    });
    expect(state.getStatus()).toBe('in_progress');
  });
});

describe('technicalVisitService.assignTechnician', () => {
  function mockVisit(status: string) {
    (TechnicianModel.findOne as any).mockResolvedValue({ _id: TECH_ID });
    let currentStatus = status;
    (TechnicalVisitModel.updateOne as any).mockImplementation((filter: any) => {
      const allowed = filter.status?.$in;
      if (Array.isArray(allowed) && allowed.includes(currentStatus)) {
        currentStatus = 'assigned';
      }
      return { modifiedCount: 1 };
    });
    (TechnicalVisitModel.findOneAndUpdate as any).mockReturnValue({
      populate: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: VISIT_ID, status: currentStatus, assignedTechnicianId: TECH_ID }),
      }),
    });
    return { getStatus: () => currentStatus };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('promotes a scheduled VT to assigned', async () => {
    const state = mockVisit('scheduled');
    await technicalVisitService.assignTechnician(VISIT_ID, TECH_ID, TENANT_ID, USER_ID);
    expect(state.getStatus()).toBe('assigned');
    expect(TechnicalVisitModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: { $in: ['scheduled', 'confirmed'] } }),
      { $set: { status: 'assigned' } },
    );
  });

  it('promotes a confirmed VT to assigned', async () => {
    const state = mockVisit('confirmed');
    await technicalVisitService.assignTechnician(VISIT_ID, TECH_ID, TENANT_ID, USER_ID);
    expect(state.getStatus()).toBe('assigned');
  });

  it('does NOT overwrite an advanced status (in_progress) on a VT', async () => {
    const state = mockVisit('in_progress');
    await technicalVisitService.assignTechnician(VISIT_ID, TECH_ID, TENANT_ID, USER_ID);
    expect(state.getStatus()).toBe('in_progress');
  });
});

describe('POST /api/operations/work-orders/[id]/assign — unassign', () => {
  let state: { _id: string; tenantId: string; status: string; assignedTechnicians: string[] };

  function mockUnassignRoute(initial: { status: string; assignedTechnicians: string[] }) {
    state = { _id: WO_ID, tenantId: TENANT_ID, ...initial };
    (requireAssignPermission as any).mockResolvedValue({});
    // Mimic a Mongoose query: select() returns a thenable (await -> doc) that
    // also exposes lean() for the resolveWorkOrderId lookup.
    (WorkOrderModel.findOne as any).mockImplementation(() => {
      const doc = () => ({ _id: state._id, ...state });
      return {
        select: vi.fn().mockReturnValue({
          then: (onFulfilled: (doc: unknown) => unknown) => Promise.resolve(doc()).then(onFulfilled),
          lean: vi.fn().mockImplementation(async () => doc()),
        }),
      };
    });
    (WorkOrderModel.findByIdAndUpdate as any).mockImplementation((_id: any, update: any) => {
      if (update.$pull?.assignedTechnicians) {
        const removed = String(update.$pull.assignedTechnicians);
        state.assignedTechnicians = state.assignedTechnicians.filter((t) => t !== removed);
      }
      return { ...state };
    });
    (WorkOrderModel.updateOne as any).mockImplementation((filter: any, update: any) => {
      const allowed = filter.status?.$in;
      if (Array.isArray(allowed) && allowed.includes(state.status)) {
        state.status = update.$set.status;
      }
      return { modifiedCount: 1 };
    });
    (WorkOrderAssignmentModel.findByIdAndUpdate as any).mockResolvedValue({});
    vi.spyOn(workAssignmentService, 'getCurrentAssignment').mockResolvedValue({ _id: WO_ID });
  }

  function mockParams(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  function mockRequest() {
    return {
      headers: new Headers({ 'x-tenant-id': TENANT_ID, 'x-user-id': USER_ID }),
      json: vi.fn().mockResolvedValue({ action: 'unassign', technicianId: TECH_ID }),
    } as any;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['assigned', 'scheduled'])('downgrades a %s WO to confirmed when the last technician is removed', async (status) => {
    mockUnassignRoute({ status, assignedTechnicians: [TECH_ID] });
    const res = await AssignPOST(mockRequest(), mockParams(WO_ID));
    expect(res.status).toBe(200);
    expect(state.status).toBe('confirmed');
  });

  it.each(['in_progress', 'completed'])('keeps %s status (never downgrades) when the last technician is removed', async (status) => {
    mockUnassignRoute({ status, assignedTechnicians: [TECH_ID] });
    const res = await AssignPOST(mockRequest(), mockParams(WO_ID));
    expect(res.status).toBe(200);
    expect(state.status).toBe(status);
    expect(WorkOrderModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: { $in: ['scheduled', 'assigned'] } }),
      expect.anything(),
    );
  });

  it('does not downgrade when technicians remain', async () => {
    mockUnassignRoute({ status: 'assigned', assignedTechnicians: [TECH_ID, 'aaaaaaaaaaaaaaaaaaaaaaaa'] });
    const res = await AssignPOST(mockRequest(), mockParams(WO_ID));
    expect(res.status).toBe(200);
    expect(state.status).toBe('assigned');
    expect(WorkOrderModel.updateOne).not.toHaveBeenCalled();
  });

  it('scopes the lookup and downgrade to the tenant', async () => {
    mockUnassignRoute({ status: 'assigned', assignedTechnicians: [TECH_ID] });
    await AssignPOST(mockRequest(), mockParams(WO_ID));

    const findOneFilters = (WorkOrderModel.findOne as any).mock.calls.map((call: any[]) => call[0]);
    expect(findOneFilters.length).toBeGreaterThan(0);
    for (const filter of findOneFilters) {
      expect(String(filter.tenantId)).toBe(TENANT_ID);
      expect(filter.deletedAt).toBeNull();
    }

    expect(WorkOrderModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: expect.any(Object),
        tenantId: expect.any(Object),
      }),
      { $set: expect.objectContaining({ status: 'confirmed' }) },
    );
  });
});
