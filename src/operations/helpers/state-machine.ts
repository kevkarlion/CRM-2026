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
  assigned: ['en_route', 'scheduled', 'cancelled'],
  en_route: ['on_site', 'cancelled'],
  on_site: ['paused', 'completed', 'cancelled'],
  paused: ['on_site', 'cancelled'],
  completed: ['closed'],
  cancelled: [],
  closed: [],
};

export const TERMINAL_STATUSES: WorkOrderStatus[] = ['cancelled', 'closed'];

export const ACTIVE_STATUSES: WorkOrderStatus[] = [
  'scheduled', 'confirmed', 'assigned', 'en_route', 'on_site', 'paused',
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

  if (from === 'assigned' && to === 'en_route' && !context.hasChecklist) {
    throw new TransitionError(
      `Checklist required: ${from} → ${to}`,
      from, to,
      'PreVisitChecklist must be completed before transitioning to en_route.',
    );
  }

  if (from === 'on_site' && to === 'completed' && !context.hasVisitReport) {
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
