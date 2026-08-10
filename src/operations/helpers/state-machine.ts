import { WorkOrderStatus } from '../types/work-order';

export interface TransitionContext {
  hasChecklist?: boolean;
  hasVisitReport?: boolean;
  hasTechnicians?: boolean;
  hasSchedule?: boolean;
}

/**
 * Transiciones canónicas de estados de OT
 * 
 * Flujo: draft → scheduled → in_progress → completed
 *                                                    ↓
 *                                                  cancelled
 */
export const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  // 1. Borrador → puede programarse o cancelarse
  draft: ['scheduled', 'cancelled'],
  
  // 2. Programada → puede iniciarse o cancelarse
  scheduled: ['in_progress', 'cancelled'],
  
  // 3. En ejecución → puede completarse o cancelarse
  in_progress: ['completed', 'cancelled'],
  
  // 4. Completada → estado terminal
  completed: [],
  
  // 5. Cancelada → estado terminal
  cancelled: [],
};

export const TERMINAL_STATUSES: WorkOrderStatus[] = ['cancelled', 'completed'];

export const ACTIVE_STATUSES: WorkOrderStatus[] = [
  'draft', 'scheduled', 'in_progress',
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

  if (from === 'scheduled' && to === 'in_progress' && !context.hasChecklist) {
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

  // Para pasar a "Programada" debe tener técnico Y fecha/hora
  if (to === 'scheduled' && (!context.hasTechnicians || !context.hasSchedule)) {
    throw new TransitionError(
      `Schedule required: ${from} → ${to}`,
      from, to,
      'At least one technician AND scheduledDate/scheduledStart must be set.',
    );
  }
}
