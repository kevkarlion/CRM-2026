import { describe, it, expect } from 'vitest';
import { deriveWorkStatus } from '../../src/operations/helpers/work-status';
import { WorkOrderStatus, WorkStatus } from '../../src/operations/types/work-order';

const CASES: Array<[WorkOrderStatus, Extract<WorkStatus, 'active' | 'paused' | 'cancelled' | 'completed'>]> = [
  ['draft', 'active'],
  ['scheduled', 'active'],
  ['assigned', 'active'],
  ['in_progress', 'active'],
  ['paused', 'paused'],
  ['completed', 'completed'],
  ['closed', 'completed'],
  ['cancelled', 'cancelled'],
];

describe('deriveWorkStatus', () => {
  it('maps every WorkOrderStatus to the documented business status', () => {
    for (const [status, expected] of CASES) {
      expect(deriveWorkStatus(status)).toBe(expected);
    }
  });
});