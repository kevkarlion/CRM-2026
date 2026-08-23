import type { ConversationState, ConversationContext } from './conversation';

// FSM SIMPLE Y DETERMINISTA - Basado en spec del usuario
// Scoring sí va, handoff NO - solo pasos lineales
const TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  // Estado inicial
  idle: ['greeting_personalized'],
  
  // Menu principal → ramas
  greeting_personalized: ['urgency', 'quote_work', 'spare_part', 'general_query', 'suppliers_info'],
  
  // Rama Servicios (opciones 1, 2, 3)
  urgency: ['detail'],
  detail: ['location_asked'],
  location_asked: ['name'],
  name: ['scored'],
  
  // Rama Cotización (opción 4)
  quote_work: ['scored'],
  
  // Rama Repuestos (opción 5)
  spare_part: ['scored'],
  
  // Rama Otra consulta (opción 6)
  general_query: ['scored'],
  
  // Rama Proveedores (opción 7) - directo a cierre
  suppliers_info: ['summary'],
  
  // Scoring
  scored: ['summary'],
  
  // Estados de cierre
  summary: ['closed'],
  closed: [],
};

// Estados que representan que se hizo una pregunta al usuario
const QUESTION_STATES: ConversationState[] = [
  'need_type_asked',
  'detail_asked',
  'customer_type_asked',
  'urgency_asked',
  'location_asked',
  'equipment_asked',
  'greeting_personalized',
  'urgency',
  'detail',
  'description',
  'name',
  'address_confirm',
  'priority',
  'quote_work',
  'spare_part',
  'general_query',
  'suppliers_info',
];

// Estados que representan que se capturó información
const CAPTURED_STATES: ConversationState[] = [
  'need_type_captured',
  'detail_captured',
  'customer_type_captured',
  'urgency_captured',
  'location_captured',
  'equipment_captured',
  'urgency_captured',
  'detail_captured',
  'name_captured',
  'address_confirmed',
  'priority_captured',
  'quote_work_captured',
  'spare_part_captured',
  'general_query_captured',
];

// Estado final de la conversación
const TERMINAL_STATES: ConversationState[] = ['closed', 'summary', 'waiting_operator']; // Eliminado handoff_pending, human_assigned

export interface StateTransitionResult {
  nextState: ConversationState;
  skippedStates: ConversationState[];
  isValid: boolean;
}

export interface HandoffCheckResult {
  shouldHandoff: boolean;
  reason?: string;
}

export class ConversationStateMachine {
  /**
   * Valida si una transición es permitida
   */
  canTransition(current: ConversationState, target: ConversationState): boolean {
    const allowed = TRANSITIONS[current];
    return allowed ? allowed.includes(target) : false;
  }

  /**
   * Obtiene los siguientes estados válidos desde un estado actual
   */
  getValidTransitions(current: ConversationState): ConversationState[] {
    return TRANSITIONS[current] ?? [];
  }

  /**
   * Determina el siguiente estado basándose en el contexto actual.
   * Si el contexto ya tiene datos, salta los pasos que no son necesarios.
   * Implementa la lógica de "skip steps if data already available".
   */
  advanceState(
    current: ConversationState,
    context: ConversationContext,
    message?: string
  ): StateTransitionResult {
    const skipped: ConversationState[] = [];

    // Si estamos en un terminal, no avanzar
    if (TERMINAL_STATES.includes(current)) {
      return { nextState: current, skippedStates: [], isValid: false };
    }

    // Si está en idle, siempre ir a greeting_personalized (nuevo flow de cliente)
    if (current === 'idle') {
      return { nextState: 'greeting_personalized', skippedStates: [], isValid: true };
    }

    // ELIMINADO: Si el usuario pide humano, ir directo a handoff
    // No hay handoff - el flow continúa normalmente
    // if (context.userAskedForHuman) {
    //   return {
    //     nextState: 'handoff_pending',
    //     skippedStates: [],
    //     isValid: true,
    //   };
    // }

    // Calcular el siguiente estado ideal, saltando los que ya tienen data
    let next = this.getNextIdealState(current, context, skipped, message);

    // Validar que la transición sea legal
    if (!this.canTransition(current, next)) {
      // Si no es legal, intentar con el siguiente ideal
      const validTransitions = this.getValidTransitions(current);
      if (validTransitions.length > 0) {
        next = validTransitions[0];
      } else {
        return { nextState: current, skippedStates: [], isValid: false };
      }
    }

    return { nextState: next, skippedStates: skipped, isValid: true };
  }

  /**
   * Calcula el siguiente estado ideal saltando pasos innecesarios
   */
  private getNextIdealState(
    current: ConversationState,
    context: ConversationContext,
    skipped: ConversationState[],
    message?: string
  ): ConversationState {
    // Mapa de estado preguntado → campo que necesita capturar.
    // Solo se mapean los estados de pregunta; el resto mapea a null.
    const STATE_FIELD_MAP: Partial<Record<ConversationState, keyof ConversationContext | null>> = {
      need_type_asked: 'needType',
      detail_asked: null, // detail no tiene campo obligatorio
      customer_type_asked: 'customerType',
      urgency_asked: 'urgency',
      location_asked: 'location',
      equipment_asked: 'equipmentType',
    };

    // Flujo ideal de estados para preguntar información
    const QUESTION_FLOW: ConversationState[] = [
      'need_type_asked',
      'detail_asked',
      'urgency_asked',
      'location_asked',
      'equipment_asked',
    ];

    // Si estamos en un estado de pregunta, verificar si el campo ya tiene datos
    if (current in STATE_FIELD_MAP && STATE_FIELD_MAP[current as ConversationState]) {
      const field = STATE_FIELD_MAP[current as ConversationState] as keyof ConversationContext;
      if (context[field]) {
        // Ya tenemos el dato, saltar al siguiente
        const currentIdx = QUESTION_FLOW.indexOf(current);
        if (currentIdx >= 0 && currentIdx < QUESTION_FLOW.length - 1) {
          return this.skipAheadFrom(current, context, skipped);
        }
      }
    }

    // Si estamos en greeting, ir a need_type_asked
    if (current === 'greeting') {
      return 'need_type_asked';
    }

    // Si estamos en greeting_personalized (nuevo flow 7 ramas), solo avanzar si el usuario eligió una opción (1-7)
    if (current === 'greeting_personalized') {
      // Solo avanzar si el usuario eligió explícitamente una opción 1-7
      const trimmed = message?.toLowerCase().trim();
      if (trimmed && /^[1-7]$/.test(trimmed)) {
        // Mapear opción a serviceType
        const OPTION_MAP: Record<string, string> = {
          '1': 'maintenance',
          '2': 'repair',
          '3': 'installation',
          '4': 'budget',
          '5': 'spare_parts',
          '6': 'other',
          '7': 'suppliers',
        };
        const serviceType = OPTION_MAP[trimmed];
        if (serviceType === 'budget') return 'quote_work';
        if (serviceType === 'spare_parts') return 'spare_part';
        if (serviceType === 'other') return 'general_query';
        if (serviceType === 'suppliers') return 'suppliers_info';
        // Para servicios (maintenance, repair, installation), ir a urgency
        return 'urgency';
      }
      // Si no eligió 1-7, quedarse en greeting_personalized (el bot reenviará el menú)
      return 'greeting_personalized';
    }

    // Si estamos en fallback, retomar el flujo desde el punto correcto
    if (current === 'fallback') {
      return this.skipAheadFrom('need_type_asked', context, skipped);
    }

    // Flujo normal desde un estado de pregunta (OLD flow)
    const currentIdx = QUESTION_FLOW.indexOf(current);
    if (currentIdx >= 0) {
      return this.skipAheadFrom(current, context, skipped);
    }

    // === NUEVO FLOW DE 7 RAMAS ===
    // Estados de captura del nuevo flow → siguiente pregunta
    const newCaptureToNext: Partial<Record<ConversationState, ConversationState>> = {
      // Mantenimiento, Reparación, Instalación
      urgency: 'detail',
      detail: 'address_confirm',
      address_confirm: 'name',
      name: 'summary',
      priority: 'description',
      description: 'summary',
      // Cotización
      quote_work: 'name',
      // Repuestos - va directo a cierre (no necesita visita)
      spare_part: 'summary',
      // Otra consulta
      general_query: 'name',
      // Proveedores
      suppliers_info: 'summary',
      // Estados finales
      summary: 'closed',
      waiting_operator: 'closed',
    };

    if (current in newCaptureToNext) {
      const nextState = newCaptureToNext[current as ConversationState];
      console.log(`[StateMachine] New flow: ${current} → ${nextState}`);
      return nextState;
    }

    // Si estamos en un estado de captura, ir al siguiente pregunta
    // Flujo normal desde un estado de captura → siguiente pregunta
    // Nota: Para repuestos (spare_parts) y otros (other), se salta urgency y location
    // y se va directo a evaluate después de detail_captured
    const isQuickNeedType = context.needType === 'spare_parts' || context.needType === 'other';
    
    const captureToNext: Partial<Record<ConversationState, ConversationState>> = {
      need_type_captured: 'detail_asked',
      detail_captured: isQuickNeedType ? 'evaluate' : 'urgency_asked',
      customer_type_captured: 'urgency_asked',
      urgency_captured: isQuickNeedType ? 'evaluate' : 'location_asked',
      location_captured: 'equipment_asked',
      equipment_captured: 'evaluate',
    };

    if (current in captureToNext) {
      const nextCandidate = captureToNext[current as ConversationState];
      if (nextCandidate) {
        return this.skipAheadFrom(nextCandidate, context, skipped);
      }
    }

    // Si estamos en evaluate, ir a scored
    if (current === 'evaluate') {
      return 'scored';
    }

    // Si estamos en scored, evaluar si hay handoff o cerrar
    if (current === 'scored') {
      return 'closed';
    }

    // Fallback: ir al siguiente estado válido
    const validTransitions = this.getValidTransitions(current);
    return validTransitions.length > 0 ? validTransitions[0] : current;
  }

  /**
   * Salta adelante en el flujo de preguntas si la data ya existe
   */
  private skipAheadFrom(
    fromState: ConversationState,
    context: ConversationContext,
    skipped: ConversationState[]
  ): ConversationState {
    const QUESTION_FLOW: ConversationState[] = [
      'need_type_asked',
      'detail_asked',
      'urgency_asked',
      'location_asked',
      'equipment_asked',
    ];

    const STATE_FIELD_MAP: Record<string, keyof ConversationContext | null> = {
      need_type_asked: 'needType',
      detail_asked: null,
      urgency_asked: 'urgency',
      location_asked: 'location',
      equipment_asked: 'equipmentType',
    };

    const startIdx = QUESTION_FLOW.indexOf(fromState);
    if (startIdx < 0) return fromState;

    for (let i = startIdx; i < QUESTION_FLOW.length; i++) {
      const state = QUESTION_FLOW[i];
      const field = STATE_FIELD_MAP[state];

      if (!field || context[field]) {
        // Este paso no tiene campo obligatorio o ya tiene dato → saltar
        skipped.push(state);
        continue;
      }

      // Este paso necesita hacerse
      return state;
    }

    // Todos los pasos completados → evaluate
    return 'evaluate';
  }

  /**
   * Maneja un fallback (respuesta no entendida)
   * Retorna el siguiente estado y si se debe hacer handoff
   */
  handleFallback(
    current: ConversationState,
    fallbackCount: number
  ): { nextState: ConversationState; shouldHandoff: boolean } {
    if (fallbackCount >= 3) {
      return { nextState: 'timeout', shouldHandoff: true };
    }
    return { nextState: 'fallback', shouldHandoff: false };
  }

  /**
   * Maneja timeout por inactividad
   */
  handleTimeout(
    timeoutCount: number
  ): { nextState: ConversationState; shouldHandoff: boolean } {
    if (timeoutCount >= 2) {
      return { nextState: 'handoff_pending', shouldHandoff: true };
    }
    return { nextState: 'timeout', shouldHandoff: false };
  }

  /**
   * Verifica si la conversación está en un estado estancado
   * (mismo estado por más de N intercambios)
   */
  isStuck(
    current: ConversationState,
    exchangesInSameState: number
  ): boolean {
    // Si lleva 3+ intercambios en el mismo estado de pregunta, está estancado
    if (QUESTION_STATES.includes(current) && exchangesInSameState >= 3) {
      return true;
    }
    // Si está en fallback y ya hubo intercambio
    if (current === 'fallback' && exchangesInSameState >= 1) {
      return true;
    }
    return false;
  }

  /**
   * Indica si un estado es terminal (la conversación ya no puede avanzar)
   */
  isTerminal(state: ConversationState): boolean {
    return TERMINAL_STATES.includes(state);
  }

  /**
   * Indica si el estado requiere que el bot envíe un mensaje al usuario
   */
  isQuestionState(state: ConversationState): boolean {
    return QUESTION_STATES.includes(state);
  }

  /**
   * Indica si el estado representa información capturada
   */
  isCapturedState(state: ConversationState): boolean {
    return CAPTURED_STATES.includes(state);
  }
}
