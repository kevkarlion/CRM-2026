import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/core/db', () => ({ connectDB: vi.fn() }));
vi.mock('@/audit/activity-logger', () => ({ logActivity: vi.fn() }));

vi.mock('@/operations/models', () => ({
  WorkOrderModel: { findOne: vi.fn(), findByIdAndUpdate: vi.fn() },
}));
vi.mock('@/operations/models/work-order-assignment', () => ({
  default: { findOne: vi.fn() },
}));
vi.mock('@/operations/models/technical-visit', () => ({
  TechnicalVisitModel: { findOne: vi.fn(), findByIdAndUpdate: vi.fn() },
}));
vi.mock('@/operations/models/technician', () => ({
  TechnicianModel: { findById: vi.fn(), findByIdAndUpdate: vi.fn() },
}));

import { POST as WOStartPOST } from '@/app/api/operations/work-orders/[id]/start/route';
import { POST as VTStartPOST } from '@/app/api/operations/technical-visits/[id]/start/route';
import { WorkOrderModel } from '@/operations/models';
import WorkOrderAssignmentModel from '@/operations/models/work-order-assignment';
import { TechnicalVisitModel } from '@/operations/models/technical-visit';
import { TechnicianModel } from '@/operations/models/technician';

const TENANT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const WO_ID = 'cccccccccccccccccccccccc';
const TECH_ID = 'dddddddddddddddddddddddd';
const VISIT_ID = 'eeeeeeeeeeeeeeeeeeeeeeee';

function mockRequest() {
  return {
    headers: new Headers({ 'x-tenant-id': TENANT_ID, 'x-user-id': USER_ID }),
  } as any;
}

function mockParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/operations/work-orders/[id]/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockWorkOrder(status: string) {
    (WorkOrderModel.findOne as any).mockResolvedValue({ _id: WO_ID, status, tenantId: TENANT_ID });
  }

  function mockValidAssignment() {
    (WorkOrderAssignmentModel.findOne as any).mockReturnValue({
      populate: vi.fn().mockResolvedValue({ technicianId: { _id: TECH_ID, userId: USER_ID } }),
    });
    (WorkOrderModel.findByIdAndUpdate as any).mockResolvedValue({});
    (TechnicianModel.findByIdAndUpdate as any).mockResolvedValue({});
  }

  it('allows start when status is scheduled', async () => {
    mockWorkOrder('scheduled');
    mockValidAssignment();
    const res = await WOStartPOST(mockRequest(), mockParams(WO_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('in_progress');
  });

  it('allows start when status is assigned', async () => {
    mockWorkOrder('assigned');
    mockValidAssignment();
    const res = await WOStartPOST(mockRequest(), mockParams(WO_ID));
    expect(res.status).toBe(200);
  });

  it('rejects start from draft', async () => {
    mockWorkOrder('draft');
    const res = await WOStartPOST(mockRequest(), mockParams(WO_ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Cannot start work from status: draft');
  });

  it('rejects start from confirmed', async () => {
    mockWorkOrder('confirmed');
    const res = await WOStartPOST(mockRequest(), mockParams(WO_ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Cannot start work from status: confirmed');
  });

  it('rejects start from completed', async () => {
    mockWorkOrder('completed');
    const res = await WOStartPOST(mockRequest(), mockParams(WO_ID));
    expect(res.status).toBe(400);
  });

  it('rejects start from in_progress with "Work already in progress"', async () => {
    mockWorkOrder('in_progress');
    const res = await WOStartPOST(mockRequest(), mockParams(WO_ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Work already in progress');
  });

  it('rejects start when there is no active technician assignment', async () => {
    mockWorkOrder('scheduled');
    (WorkOrderAssignmentModel.findOne as any).mockReturnValue({
      populate: vi.fn().mockResolvedValue(null),
    });
    const res = await WOStartPOST(mockRequest(), mockParams(WO_ID));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain('No active technician assignment found');
  });

  it('rejects start when the current user is not the assigned technician', async () => {
    mockWorkOrder('assigned');
    (WorkOrderAssignmentModel.findOne as any).mockReturnValue({
      populate: vi.fn().mockResolvedValue({
        technicianId: { _id: TECH_ID, userId: '999999999999999999999999' },
      }),
    });
    const res = await WOStartPOST(mockRequest(), mockParams(WO_ID));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain('Only the assigned technician can start this work');
  });
});

describe('POST /api/operations/technical-visits/[id]/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockVisit(status: string) {
    (TechnicalVisitModel.findOne as any).mockResolvedValue({
      _id: VISIT_ID,
      status,
      tenantId: TENANT_ID,
      assignedTechnicianId: TECH_ID,
    });
  }

  function mockValidTechnician() {
    (TechnicianModel.findById as any).mockResolvedValue({ _id: TECH_ID, userId: USER_ID });
    (TechnicalVisitModel.findByIdAndUpdate as any).mockResolvedValue({});
    (TechnicianModel.findByIdAndUpdate as any).mockResolvedValue({});
  }

  it('allows start when status is scheduled', async () => {
    mockVisit('scheduled');
    mockValidTechnician();
    const res = await VTStartPOST(mockRequest(), mockParams(VISIT_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('in_progress');
  });

  it('allows start when status is assigned', async () => {
    mockVisit('assigned');
    mockValidTechnician();
    const res = await VTStartPOST(mockRequest(), mockParams(VISIT_ID));
    expect(res.status).toBe(200);
  });

  it('rejects start from confirmed', async () => {
    mockVisit('confirmed');
    const res = await VTStartPOST(mockRequest(), mockParams(VISIT_ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Cannot start work from status: confirmed');
  });

  it('rejects start from draft', async () => {
    mockVisit('draft');
    const res = await VTStartPOST(mockRequest(), mockParams(VISIT_ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Cannot start work from status: draft');
  });

  it('rejects start from completed', async () => {
    mockVisit('completed');
    const res = await VTStartPOST(mockRequest(), mockParams(VISIT_ID));
    expect(res.status).toBe(400);
  });

  it('rejects start from in_progress with "Work already in progress"', async () => {
    mockVisit('in_progress');
    const res = await VTStartPOST(mockRequest(), mockParams(VISIT_ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Work already in progress');
  });

  it('rejects start when no technician is assigned to the visit', async () => {
    (TechnicalVisitModel.findOne as any).mockResolvedValue({
      _id: VISIT_ID,
      status: 'assigned',
      tenantId: TENANT_ID,
      assignedTechnicianId: null,
    });
    const res = await VTStartPOST(mockRequest(), mockParams(VISIT_ID));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain('No technician assigned to this visit');
  });

  it('rejects start when the current user is not the assigned technician', async () => {
    mockVisit('assigned');
    (TechnicianModel.findById as any).mockResolvedValue({
      _id: TECH_ID,
      userId: '999999999999999999999999',
    });
    const res = await VTStartPOST(mockRequest(), mockParams(VISIT_ID));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain('Only the assigned technician can start this work');
  });
});
