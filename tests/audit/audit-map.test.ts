import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainEvent } from '@/infrastructure/events/event.types';

vi.mock('@/audit/services/activity-log.service', () => ({
  activityLogService: { create: vi.fn() },
}));

import { auditHandler } from '@/audit/handlers/audit.handler';
import { activityLogService } from '@/audit/services/activity-log.service';

const TENANT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const WO_ID = 'cccccccccccccccccccccccc';

function buildEvent(type: string): DomainEvent {
  return {
    type,
    aggregateId: WO_ID,
    aggregateType: 'WorkOrder',
    tenantId: TENANT_ID,
    userId: USER_ID,
    timestamp: new Date(),
    payload: {},
  };
}

describe('auditHandler mapEventToAction (technician assignment)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps WORK_ORDER_TECHNICIAN_ASSIGNED to technician.assigned', async () => {
    await auditHandler.onAnyEvent(buildEvent('WORK_ORDER_TECHNICIAN_ASSIGNED'));

    expect(activityLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        entityType: 'WorkOrder',
        entityId: WO_ID,
        action: 'technician.assigned',
        actorId: USER_ID,
      }),
    );
  });

  it('maps WORK_ORDER_TECHNICIAN_CHANGED to technician.reassigned', async () => {
    await auditHandler.onAnyEvent(buildEvent('WORK_ORDER_TECHNICIAN_CHANGED'));

    expect(activityLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'technician.reassigned' }),
    );
  });

  it('maps WORK_ORDER_TECHNICIAN_UNASSIGNED to technician.unassigned', async () => {
    await auditHandler.onAnyEvent(buildEvent('WORK_ORDER_TECHNICIAN_UNASSIGNED'));

    expect(activityLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'technician.unassigned' }),
    );
  });

  it('maps WORK_ORDER_SELF_ASSIGNED to technician.assigned (not the generic updated fallback)', async () => {
    await auditHandler.onAnyEvent(buildEvent('WORK_ORDER_SELF_ASSIGNED'));

    expect(activityLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'technician.assigned' }),
    );
  });
});
