import { describe, it, expect } from 'vitest';
import { workOrderEventSchema } from '../../src/operations/schemas/work-order-event';
import { workOrderSchema } from '../../src/operations/schemas/work-order';
import { WorkOrderEventType } from '../../src/operations/types/work-order-event';

function eventEnum(): readonly string[] {
  const path = workOrderEventSchema.path('eventType') as any;
  return (path && path.options && path.options.enum) || [];
}

describe('WorkOrderEvent schema enum', () => {
  it('accepts cancelled, paused and completed event writes', () => {
    const enumValues = eventEnum();
    expect(enumValues).toContain('cancelled');
    expect(enumValues).toContain('paused');
    expect(enumValues).toContain('completed');
  });

  it('keeps the original event types in the enum', () => {
    const types: WorkOrderEventType[] = [
      'created', 'assigned', 'status_changed', 'checklist_completed',
      'technician_changed', 'visit_started', 'visit_completed',
      'attachment_uploaded', 'note_added', 'closed', 'rescheduled',
    ];
    const enumValues = eventEnum();
    for (const t of types) {
      expect(enumValues).toContain(t);
    }
  });
});

describe('WorkOrder schema', () => {
  it('persists cancelledAt mirroring the closedAt shape (Date, default null)', () => {
    const closedAt = workOrderSchema.path('closedAt') as any;
    const cancelledAt = workOrderSchema.path('cancelledAt') as any;
    expect(cancelledAt).toBeDefined();
    expect(cancelledAt.instance).toBe(closedAt.instance);
    expect(cancelledAt.options.default).toBe(closedAt.options.default);
  });
});