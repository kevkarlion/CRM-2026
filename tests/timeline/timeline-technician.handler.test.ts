import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainEvent } from '@/infrastructure/events/event.types';
import { WorkOrderTechnicianAssignmentPayload } from '@/infrastructure/events/event.types';

vi.mock('@/timeline/services/timeline.service', () => ({
  timelineService: { create: vi.fn() },
}));

import { timelineHandler } from '@/timeline/handlers/timeline.handler';
import { timelineService } from '@/timeline/services/timeline.service';

const TENANT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const WO_ID = 'cccccccccccccccccccccccc';
const LEAD_ID = 'dddddddddddddddddddddddd';
const TECH_A = 'eeeeeeeeeeeeeeeeeeeeeeee';
const TECH_B = 'ffffffffffffffffffffffff';

function buildEvent(overrides: Partial<WorkOrderTechnicianAssignmentPayload>): DomainEvent<WorkOrderTechnicianAssignmentPayload> {
  return {
    type: 'WORK_ORDER_TECHNICIAN_ASSIGNED',
    aggregateId: WO_ID,
    aggregateType: 'WorkOrder',
    tenantId: TENANT_ID,
    userId: USER_ID,
    timestamp: new Date(),
    payload: {
      workOrderId: WO_ID,
      number: 'WO-0001',
      leadId: LEAD_ID,
      technicianId: TECH_A,
      technicianName: 'Tech A',
      previousTechnicianId: null,
      previousTechnicianName: null,
      assignmentType: 'manual',
      reason: 'availability',
      fromStatus: 'scheduled',
      toStatus: 'assigned',
      ...overrides,
    },
  };
}

describe('timelineHandler technician assignment events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('onTechnicianAssigned creates workorder.technician_assigned with real leadId and Spanish title', async () => {
    await timelineHandler.onTechnicianAssigned(buildEvent({}));

    expect(timelineService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        leadId: LEAD_ID,
        entityType: 'work_order',
        entityId: WO_ID,
        eventType: 'workorder.technician_assigned',
        title: 'Técnico Tech A asignado a OT #WO-0001',
        icon: 'user-plus',
        color: 'orange',
        performedBy: USER_ID,
        metadata: expect.objectContaining({
          technicianId: TECH_A,
          technicianName: 'Tech A',
          previousTechnicianId: null,
          number: 'WO-0001',
          reason: 'availability',
          assignmentType: 'manual',
          fromStatus: 'scheduled',
          toStatus: 'assigned',
        }),
      }),
    );
  });

  it('onTechnicianChanged creates workorder.technician_changed with previous technician', async () => {
    await timelineHandler.onTechnicianChanged(
      buildEvent({
        previousTechnicianId: TECH_B,
        previousTechnicianName: 'Tech B',
      }),
    );

    expect(timelineService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        leadId: LEAD_ID,
        entityType: 'work_order',
        entityId: WO_ID,
        eventType: 'workorder.technician_changed',
        title: 'Técnico Tech A reemplazó a Tech B en OT #WO-0001',
        icon: 'refresh-cw',
        color: 'indigo',
        performedBy: USER_ID,
        metadata: expect.objectContaining({
          technicianId: TECH_A,
          technicianName: 'Tech A',
          previousTechnicianId: TECH_B,
          previousTechnicianName: 'Tech B',
          number: 'WO-0001',
        }),
      }),
    );
  });

  it('onTechnicianUnassigned creates workorder.technician_unassigned with fromStatus', async () => {
    await timelineHandler.onTechnicianUnassigned(
      buildEvent({
        previousTechnicianId: null,
        previousTechnicianName: null,
        fromStatus: 'assigned',
        toStatus: 'confirmed',
        reason: 'other',
      }),
    );

    expect(timelineService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        leadId: LEAD_ID,
        entityType: 'work_order',
        entityId: WO_ID,
        eventType: 'workorder.technician_unassigned',
        title: 'Técnico Tech A desasignado de OT #WO-0001',
        icon: 'user-minus',
        color: 'gray',
        performedBy: USER_ID,
        metadata: expect.objectContaining({
          technicianId: TECH_A,
          technicianName: 'Tech A',
          previousTechnicianId: null,
          number: 'WO-0001',
          reason: 'other',
          fromStatus: 'assigned',
          toStatus: 'confirmed',
        }),
      }),
    );
  });
});
