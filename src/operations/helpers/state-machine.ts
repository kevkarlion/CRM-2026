import { WorkOrderStatus } from '../types/work-order';

export interface TransitionContext {
  hasChecklist?: boolean;
  hasVisitReport?: boolean;
  hasTechnicians?: boolean;
  hasSchedule?: boolean;
}

export const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['confirmed', 'assigned', 'cancelled'],
  confirmed: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'scheduled', 'cancelled'],
  in_progress: ['paused', 'completed', 'cancelled'],
  paused: ['in_progress', 'cancelled'],
  completed: ['closed'],
  cancelled: [],
  closed: [],
};

export const TERMINAL_STATUSES: WorkOrderStatus[] = ['cancelled', 'closed'];

export const ACTIVE_STATUSES: WorkOrderStatus[] = [
  'scheduled', 'confirmed', 'assigned', 'in_progress', 'paused',
];

export function canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export class TransitionError extends Error {
  constructor(
    message: string,
    public readonly from: WorkOrderStatus,
    public readonly to: WorkOrderStatus,
    public readonly reason: string,
  ) {
    super(message);
    this.name = 'TransitionError';
  }
}

export function validateTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
  context: TransitionContext = {},
): void {
  if (!canTransition(from, to)) {
    throw new TransitionError(
      `Invalid transition: ${from} → ${to}`,
      from, to,
      `Transition from '${from}' to '${to}' is not allowed by the state machine.`,
    );
  }

  if (from === 'assigned' && to === 'in_progress' && !context.hasChecklist) {
    throw new TransitionError(
      `Checklist required: ${from} → ${to}`,
      from, to,
      'PreVisitChecklist must be completed before transitioning to in_progress.',
    );
  }

  if (from === 'in_progress' && to === 'completed' && !context.hasVisitReport) {
    throw new TransitionError(
      `VisitReport required: ${from} → ${to}`,
      from, to,
      'VisitReport must exist before transitioning to completed.',
    );
  }

  if (to === 'assigned' && !context.hasTechnicians) {
    throw new TransitionError(
      `Technicians required: ${from} → ${to}`,
      from, to,
      'At least one technician must be assigned.',
    );
  }

  if (from === 'draft' && to === 'scheduled' && !context.hasSchedule) {
    throw new TransitionError(
      `Schedule required: ${from} → ${to}`,
      from, to,
      'scheduledDate, scheduledStart, and scheduledEnd must be set.',
    );
  }
}
