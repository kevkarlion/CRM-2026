import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainEvent, DOMAIN_EVENTS } from '@/infrastructure/events/event.types';

vi.mock('@/audit/services/activity-log.service', () => ({
  activityLogService: { create: vi.fn() },
}));

import { auditHandler } from '@/audit/handlers/audit.handler';
import { activityLogService } from '@/audit/services/activity-log.service';

const TENANT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const WO_ID = 'cccccccccccccccccccccccc';
const WR_ID = 'dddddddddddddddddddddddd';

function buildEvent(type: string, payload: Record<string, unknown> = {}): DomainEvent {
  return {
    type,
    aggregateId: WO_ID,
    aggregateType: 'WorkOrder',
    tenantId: TENANT_ID,
    userId: USER_ID,
    timestamp: new Date(),
    payload,
  };
}

describe('auditHandler work-order unicity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('WORK_ORDER_STARTED maps to exactly one "work_started" row (no "updated" fallback)', async () => {
    await auditHandler.onAnyEvent(buildEvent(DOMAIN_EVENTS.WORK_ORDER_STARTED, {
      workOrderId: WO_ID,
      number: 'OT-0001',
      workOrderNumber: 'OT-0001',
      previousStatus: 'scheduled',
      newStatus: 'in_progress',
      technicianId: 'tech-1',
      technicianName: 'Juan Perez',
    }));

    expect(activityLogService.create).toHaveBeenCalledTimes(1);
    expect(activityLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        entityType: 'WorkOrder',
        entityId: WO_ID,
        action: 'work_started',
        actorId: USER_ID,
        metadata: expect.objectContaining({ newStatus: 'in_progress', workOrderNumber: 'OT-0001' }),
      }),
    );
  });

  it('WORK_ORDER_COMPLETED with a workReportId writes exactly "work_completed" + "work_report_created" (2 distinct rows)', async () => {
    await auditHandler.onAnyEvent(buildEvent(DOMAIN_EVENTS.WORK_ORDER_COMPLETED, {
      workOrderId: WO_ID,
      workReportId: WR_ID,
      number: 'OT-0001',
      result: 'Reparación completada',
      newStatus: 'closed',
    }));

    expect(activityLogService.create).toHaveBeenCalledTimes(2);

    expect(activityLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'WorkOrder',
        entityId: WO_ID,
        action: 'work_completed',
      }),
    );
    expect(activityLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'workReport',
        entityId: WR_ID,
        action: 'work_report_created',
      }),
    );
  });

  it('WORK_ORDER_COMPLETED without a workReportId is skipped (changeStatus("completed") duplicates WORK_ORDER_STATUS_CHANGED)', async () => {
    await auditHandler.onAnyEvent(buildEvent(DOMAIN_EVENTS.WORK_ORDER_COMPLETED, {
      workOrderId: WO_ID,
      number: 'OT-0001',
      clientId: null,
    }));

    expect(activityLogService.create).not.toHaveBeenCalled();
  });

  it('WORK_ORDER_STATUS_CHANGED still writes exactly one "status_changed" row', async () => {
    await auditHandler.onAnyEvent(buildEvent(DOMAIN_EVENTS.WORK_ORDER_STATUS_CHANGED, {
      workOrderId: WO_ID,
      from: 'assigned',
      to: 'in_progress',
    }));

    expect(activityLogService.create).toHaveBeenCalledTimes(1);
    expect(activityLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'status_changed' }),
    );
  });
});