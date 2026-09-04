import { WorkOrderStatus, WorkStatus } from '../types/work-order';

/**
 * Maps an operational WorkOrderStatus to its business workStatus.
 * Consolidated view: active/paused/cancelled/completed for dashboards and filters.
 */
export function deriveWorkStatus(status: WorkOrderStatus): Extract<WorkStatus, 'active' | 'paused' | 'cancelled' | 'completed'> {
  switch (status) {
    case 'draft':
    case 'scheduled':
    case 'assigned':
    case 'in_progress':
      return 'active';
    case 'paused':
      return 'paused';
    case 'completed':
    case 'closed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
  }
}