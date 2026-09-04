import { WorkOrderStatus } from '../types/work-order';

export interface TransitionContext {
  hasChecklist?: boolean;
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
 *                                                       ↓
 *                                                     paused
 *                                                       ↓
 *                                               (Start para reanudar)
 *
 * assigned → scheduled|draft son edges de regresion GUARDADOS: solo se
 * permiten cuando ya no queda ningun tecnico asignado (rollback de unassign).
 */

// Set canonico unico — fuente unica de verdad para todos los estados operativos.
export const CANONICAL_STATUSES: WorkOrderStatus[] = [
  'draft',
  'scheduled',
  'assigned',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
  'closed',
];

// Matriz canonica de transiciones sin contexto. Los edges de regresion
// guardados NO viven aqui: ver GUARDED_TRANSITIONS.
export const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  // 1. Borrador → puede programarse, asignarse o cancelarse
  draft: ['scheduled', 'assigned', 'cancelled'],

  // 2. Programada → puede iniciarse, asignarse, pausarse o cancelarse
  scheduled: ['assigned', 'in_progress', 'paused', 'cancelled'],

  // 3. Asignada → puede iniciarse, pausarse o cancelarse
  assigned: ['in_progress', 'paused', 'cancelled'],

  // 4. En ejecucion → puede pausarse, completarse o cancelarse
  in_progress: ['paused', 'completed', 'closed', 'cancelled'],

  // 5. Pausada → puede reanudarse (in_progress) o cancelarse
  paused: ['in_progress', 'cancelled'],

  // 6-8. Terminales: no aceptan transiciones salientes
  completed: [],
  closed: [],
  cancelled: [],
};

// Estados legacy para compatibilidad con datos existentes. Solo
// pending_assignment conserva reglas de escritura; 'confirmed' y el resto ya
// no hacen sombra sobre los estados canonicos.
export const LEGACY_TRANSITIONS: Record<string, string[]> = {
  pending_assignment: ['scheduled', 'cancelled'],
};

export const TERMINAL_STATUSES: WorkOrderStatus[] = ['cancelled', 'closed', 'completed'];

export const ACTIVE_STATUSES: WorkOrderStatus[] = [
  'draft', 'scheduled', 'in_progress',
  // Legacy active statuses
  'pending_assignment', 'assigned', 'confirmed', 'paused',
];

interface GuardedEdge {
  to: WorkOrderStatus;
  guard: (context: TransitionContext) => boolean;
}

// Edges de regresion guardados: NO forman parte de la matriz sin contexto.
// Solo son alcanzables cuando el caller demuestra la guardia (p.ej. rollback de
// unassign cuando no queda ningun tecnico).
const GUARDED_TRANSITIONS: Record<WorkOrderStatus, GuardedEdge[]> = {
  draft: [],
  scheduled: [],
  assigned: [
    {
      to: 'scheduled',
      guard: (context) => context.hasTechnicians === false,
    },
    {
      to: 'draft',
      guard: (context) => context.hasTechnicians === false,
    },
  ],
  in_progress: [],
  paused: [],
  completed: [],
  closed: [],
  cancelled: [],
};

export function canTransition(from: string, to: WorkOrderStatus): boolean {
  // Estados canonicos usan la matriz base. Los edges guardados requieren
  // contexto, por lo que jamas se permiten aqui.
  if (CANONICAL_STATUSES.includes(from as WorkOrderStatus)) {
    return VALID_TRANSITIONS[from as WorkOrderStatus]?.includes(to) ?? false;
  }
  if (from in LEGACY_TRANSITIONS) {
    return LEGACY_TRANSITIONS[from]?.includes(to) ?? false;
  }
  console.warn('[canTransition] Unknown status:', from);
  return false;
}

export function getReachableDestinations(
  from: WorkOrderStatus,
  context: TransitionContext = {},
): WorkOrderStatus[] {
  const reachable: WorkOrderStatus[] = [];

  for (const to of VALID_TRANSITIONS[from] ?? []) {
    if (!reachable.includes(to)) {
      reachable.push(to);
    }
  }

  for (const edge of GUARDED_TRANSITIONS[from] ?? []) {
    if (edge.guard(context) && !reachable.includes(edge.to)) {
      reachable.push(edge.to);
    }
  }

  return reachable;
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
  const fromCanonical = CANONICAL_STATUSES.includes(from as WorkOrderStatus);

  // Legacy writer edges (sin contexto).
  if (!fromCanonical && LEGACY_TRANSITIONS[from]?.includes(to)) {
    return;
  }

  // Matriz canonica base + guardias de negocio.
  if (fromCanonical && VALID_TRANSITIONS[from as WorkOrderStatus]?.includes(to)) {
    if (from === 'draft' && to === 'scheduled' && !context.hasSchedule) {
      throw new TransitionError(
        'Para programar la orden debes agregar una fecha',
        from, to,
        'At least scheduledDate/scheduledStart must be set.',
      );
    }
    if (from === 'draft' && to === 'assigned' && !context.hasTechnicians) {
      throw new TransitionError(
        'Para asignar la orden debes elegir un tecnico',
        from, to,
        'At least one technician must be assigned.',
      );
    }
    if ((from === 'scheduled' || from === 'assigned') && to === 'in_progress' && !context.hasChecklist) {
      throw new TransitionError(
        'Debes completar el checklist antes de iniciar el trabajo',
        from, to,
        'PreVisitChecklist must be completed before transitioning to in_progress.',
      );
    }
    return;
  }

  // Edges de regresion guardados (requieren prueba de contexto).
  if (fromCanonical) {
    const edge = GUARDED_TRANSITIONS[from as WorkOrderStatus]?.find((e) => e.to === to);
    if (edge?.guard(context)) {
      return;
    }
  }

  throw new TransitionError(
    `Invalid transition: ${from} → ${to}`,
    from as WorkOrderStatus, to,
    `Transition from '${from}' to '${to}' is not allowed by the state machine.`,
  );
}