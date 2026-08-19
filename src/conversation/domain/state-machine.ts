import type { ConversationState, ConversationContext } from './conversation';

// Transitiones válidas del state machine.
// Cada key es el estado actual, el value es el siguiente estado válido.
const TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  idle: ['greeting'],
  greeting: ['need_type_asked'],
  greeting_personalized: ['urgency', 'quote_work', 'spare_part', 'general_query', 'suppliers_info', 'evaluate'],
  need_type_asked: ['need_type_captured', 'detail_asked', 'urgency_asked', 'evaluate'],
  need_type_captured: ['detail_asked', 'urgency_asked', 'location_asked', 'evaluate'],
  detail_asked: ['detail_captured', 'urgency_asked', 'location_asked', 'evaluate'],
  detail_captured: ['urgency_asked', 'location_asked', 'equipment_asked', 'evaluate'],
  customer_type_asked: ['customer_type_captured', 'urgency_asked'],
  customer_type_captured: ['urgency_asked', 'location_asked', 'equipment_asked', 'evaluate'],
  urgency_asked: ['urgency_captured', 'location_asked', 'equipment_asked', 'evaluate'],
  urgency_captured: ['location_asked', 'equipment_asked', 'evaluate'],
  location_asked: ['location_captured', 'equipment_asked', 'evaluate'],
  location_captured: ['equipment_asked', 'evaluate'],
  equipment_asked: ['equipment_captured', 'evaluate'],
  equipment_captured: ['evaluate'],
  evaluate: ['scored', 'handoff_pending'],
  scored: ['handoff_pending', 'closed'],
  handoff_pending: ['human_assigned', 'closed'],
  human_assigned: ['closed'],
  closed: [],
  timeout: ['handoff_pending', 'closed'],
  fallback: ['greeting', 'need_type_asked', 'handoff_pending'],
  
  // Nuevos estados del flow de 7 ramas
  urgency: ['detail', 'address_confirm', 'name', 'evaluate'],
  detail: ['address_confirm', 'name', 'evaluate'],
  description: ['evaluate'],
  name: ['summary', 'evaluate'],
  address_confirm: ['priority', 'evaluate'],
  priority: ['description', 'evaluate'],
  quote_work: ['name', 'evaluate'],
  spare_part: ['name', 'evaluate'],
  general_query: ['name', 'evaluate'],
  suppliers_info: ['summary'],
  summary: ['closed'],
  waiting_operator: ['closed'],
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
const TERMINAL_STATES: ConversationState[] = ['closed', 'handoff_pending', 'human_assigned', 'summary', 'waiting_operator'];

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
    context: ConversationContext
  ): StateTransitionResult {
    const skipped: ConversationState[] = [];

    // Si estamos en un terminal, no avanzar
    if (TERMINAL_STATES.includes(current)) {
      return { nextState: current, skippedStates: [], isValid: false };
    }

    // Si el usuario pide humano, ir directo a handoff
    if (context.userAskedForHuman) {
      return {
        nextState: 'handoff_pending',
        skippedStates: [],
        isValid: true,
      };
    }

    // Calcular el siguiente estado ideal, saltando los que ya tienen data
    let next = this.getNextIdealState(current, context, skipped);

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
    skipped: ConversationState[]
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

    // Si estamos en greeting_personalized (nuevo flow 7 ramas), ir al estado según el serviceType
    if (current === 'greeting_personalized') {
      const serviceType = context.serviceType || context.needType;
      // Si ya tiene serviceType, ir directo al estado correspondiente
      if (serviceType === 'budget') return 'quote_work';
      if (serviceType === 'spare_parts') return 'spare_part';
      if (serviceType === 'other') return 'general_query';
      if (serviceType === 'suppliers') return 'suppliers_info';
      // Para servicios (maintenance, repair, installation), ir a urgency
      return 'urgency';
    }

    // Si estamos en fallback, retomar el flujo desde el punto correcto
    if (current === 'fallback') {
      return this.skipAheadFrom('need_type_asked', context, skipped);
    }

    // Flujo normal desde un estado de pregunta
    const currentIdx = QUESTION_FLOW.indexOf(current);
    if (currentIdx >= 0) {
      return this.skipAheadFrom(current, context, skipped);
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
