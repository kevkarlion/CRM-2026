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
 * Flujo: pending_assignment → assigned → scheduled → in_progress → closed
 *                                                              ↓
 *                                                            cancelled
 */
export const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  // 1. Pendiente de asignación → puede asignarse o cancelarse
  pending_assignment: ['assigned', 'cancelled'],
  
  // 2. Asignada → puede programarse o cancelarse
  assigned: ['scheduled', 'cancelled'],
  
  // 3. Programada → puede iniciar o cancelarse
  scheduled: ['in_progress', 'cancelled'],
  
  // 4. En ejecución → puede cerrarse o cancelarse
  in_progress: ['closed', 'cancelled'],
  
  // 5. Cerrada → estado terminal
  closed: [],
  
  // 6. Cancelada → estado terminal
  cancelled: [],
};

export const TERMINAL_STATUSES: WorkOrderStatus[] = ['cancelled', 'closed'];

export const ACTIVE_STATUSES: WorkOrderStatus[] = [
  'pending_assignment', 'assigned', 'scheduled', 'in_progress',
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

  // Para pasar a "Asignada" debe tener al menos un técnico
  if (to === 'assigned' && !context.hasTechnicians) {
    throw new TransitionError(
      `Technicians required: ${from} → ${to}`,
      from, to,
      'At least one technician must be assigned.',
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
