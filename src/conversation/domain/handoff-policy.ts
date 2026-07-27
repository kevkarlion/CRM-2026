import type { ConversationContext, ConversationState } from './conversation';
import type { Temperature } from '../../leads/types/lead';

export interface HandoffDecision {
  shouldHandoff: boolean;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface HandoffCheckParams {
  score: number;
  temperature: Temperature;
  context: ConversationContext;
  fallbackCount: number;
  timeoutCount: number;
  exchangesInSameState: number;
  currentState: ConversationState;
}

// Motivos de handoff con su prioridad por defecto
const HANDOFF_REASONS = {
  hot_lead: { reason: 'Lead caliente (score ≥ 70)', priority: 'high' as const },
  user_request: { reason: 'El usuario solicitó hablar con un humano', priority: 'high' as const },
  bot_confusion: { reason: 'El bot no entendió 3 veces seguidas', priority: 'medium' as const },
  timeout: { reason: 'Conversación sin respuesta por timeout', priority: 'medium' as const },
  stuck: { reason: 'Conversación estancada en el mismo paso', priority: 'low' as const },
} as const;

export class HandoffPolicy {
  /**
   * Evalúa si la conversación debe ser transferida a un humano.
   * Usa cualquier trigger que se cumpla (OR lógico).
   */
  shouldHandoff(params: HandoffCheckParams): HandoffDecision {
    // 1. Lead caliente → handoff inmediato (prioridad alta)
    if (params.temperature === 'hot' || params.score >= 70) {
      return {
        shouldHandoff: true,
        ...HANDOFF_REASONS.hot_lead,
      };
    }

    // 2. Usuario pidió humano → handoff inmediato
    if (params.context.userAskedForHuman) {
      return {
        shouldHandoff: true,
        ...HANDOFF_REASONS.user_request,
      };
    }

    // 3. Bot no entendió 3+ veces → handoff por confusión
    if (params.fallbackCount >= 3) {
      return {
        shouldHandoff: true,
        ...HANDOFF_REASONS.bot_confusion,
      };
    }

    // 4. Timeout 2+ veces → handoff por inactividad
    if (params.timeoutCount >= 2) {
      return {
        shouldHandoff: true,
        ...HANDOFF_REASONS.timeout,
      };
    }

    // 5. Conversación estancada (3+ intercambios en mismo estado)
    if (params.exchangesInSameState >= 3) {
      return {
        shouldHandoff: true,
        ...HANDOFF_REASONS.stuck,
      };
    }

    return {
      shouldHandoff: false,
      reason: '',
      priority: 'low',
    };
  }
}
