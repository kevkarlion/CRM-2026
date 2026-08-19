import { WorkOrderStatus } from '../types/work-order';

export interface TransitionContext {
  hasChecklist?: boolean;
  hasVisitReport?: boolean;
  hasTechnicians?: boolean;
  hasSchedule?: boolean;
}

/**
 * Transiciones canonicas de estados de OT
 * 
 * draft → scheduled (tiene fecha) → in_progress → completed
 *         → assigned (tiene tecnico) → in_progress
 *         → paused (pausar mientras programada/asignada)
 *         → cancelled
 *                                                    ↓
 *                                                  paused
 *                                                    ↓
 *                                            (Start para reanudar)
 */
export const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  // Estados canonicos
  // 1. Borrador → puede programarse, asignarse o cancelarse
  draft: ['scheduled', 'assigned', 'cancelled'],
  
  // 2. Programada → puede iniciarse, asignarse, pausarse o cancelarse
  scheduled: ['assigned', 'in_progress', 'paused', 'cancelled'],
  
  // 3. Asignada → puede iniciarse, pausarse o cancelarse
  assigned: ['in_progress', 'paused', 'cancelled'],
  
  // 4. En ejecucion → puede pausarse, completarse o cancelarse
  in_progress: ['paused', 'completed', 'cancelled'],
  
  // 5. Pausada → puede reanudarse (in_progress) o cancelarse
  paused: ['in_progress', 'cancelled'],
  
  // 6. Completada → estado terminal
  completed: [],
  
  // 7. Cancelada → estado terminal
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

  // Solo aplicar validaciones de contexto para estados canonicos
  const isCanonicalFrom = ['draft', 'scheduled', 'assigned', 'in_progress', 'completed', 'cancelled'].includes(from);
  if (!isCanonicalFrom) return;

  if (from === 'scheduled' && to === 'in_progress' && !context.hasChecklist) {
    throw new TransitionError(
      `Debes completar el checklist antes de iniciar el trabajo`,
      from, to,
      'PreVisitChecklist must be completed before transitioning to in_progress.',
    );
  }

  if (from === 'assigned' && to === 'in_progress' && !context.hasChecklist) {
    throw new TransitionError(
      `Debes completar el checklist antes de iniciar el trabajo`,
      from, to,
      'PreVisitChecklist must be completed before transitioning to in_progress.',
    );
  }

  if (from === 'in_progress' && to === 'completed' && !context.hasVisitReport) {
    throw new TransitionError(
      `Debes completar el reporte de trabajo antes de finalizar`,
      from, to,
      'VisitReport must exist before transitioning to completed.',
    );
  }

  // Para pasar a "Programada" debe tener al menos fecha/hora
  if (from === 'draft' && to === 'scheduled' && !context.hasSchedule) {
    throw new TransitionError(
      `Para programar la orden debes agregar una fecha`,
      from, to,
      'At least scheduledDate/scheduledStart must be set.',
    );
  }

  // Para pasar a "Asignada" debe tener al menos un tecnico
  if (from === 'draft' && to === 'assigned' && !context.hasTechnicians) {
    throw new TransitionError(
      `Para asignar la orden debes elegir un tecnico`,
      from, to,
      'At least one technician must be assigned.',
    );
  }
}
