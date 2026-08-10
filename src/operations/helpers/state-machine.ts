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
 * 
 * Estados legacy (para compatibilidad con datos existentes):
 * pending_assignment → scheduled (si hay técnico y fecha)
 * assigned → scheduled (si hay fecha)
 */
export const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  // Estados canónicos
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

// Estados legacy para compatibilidad con datos existentes
// Estos no están en el tipo WorkOrderStatus pero pueden existir en la DB
export const LEGACY_TRANSITIONS: Record<string, string[]> = {
  pending_assignment: ['scheduled', 'cancelled'],
  assigned: ['scheduled', 'cancelled'],
  confirmed: ['scheduled', 'cancelled'],
  paused: ['in_progress', 'cancelled'],
  closed: [], // terminal
};

export const TERMINAL_STATUSES: WorkOrderStatus[] = ['cancelled', 'completed'];

export const ACTIVE_STATUSES: WorkOrderStatus[] = [
  'draft', 'scheduled', 'in_progress',
  // Legacy active statuses
  'pending_assignment', 'assigned', 'confirmed', 'paused',
];

const CANONICAL_STATUSES = ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'];

export function canTransition(from: string, to: WorkOrderStatus): boolean {
  // Si es un estado canónico, usar VALID_TRANSITIONS
  if (CANONICAL_STATUSES.includes(from)) {
    return VALID_TRANSITIONS[from as WorkOrderStatus]?.includes(to) ?? false;
  }
  
  // Si es un estado legacy, usar LEGACY_TRANSITIONS
  if (from in LEGACY_TRANSITIONS) {
    return LEGACY_TRANSITIONS[from]?.includes(to) ?? false;
  }
  
  // Estado desconocido
  console.warn('[canTransition] Unknown status:', from);
  return false;
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
  from: string,
  to: WorkOrderStatus,
  context: TransitionContext = {},
): void {
  if (!canTransition(from, to)) {
    throw new TransitionError(
      `Invalid transition: ${from} → ${to}`,
      from as WorkOrderStatus, to,
      `Transition from '${from}' to '${to}' is not allowed by the state machine.`,
    );
  }

  // Solo aplicar validaciones de contexto para estados canónicos
  const isCanonicalFrom = ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'].includes(from);
  if (!isCanonicalFrom) return;

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
