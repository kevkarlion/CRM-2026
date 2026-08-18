/**
 * Urgency State
 * 
 * Asks customer about their urgency level for service requests.
 * Branch: Options 1-3 (Mantenimiento, Reparación, Instalación)
 */

import type { ConversationContext } from '../../context'
import type { ProcessResult, StateIntent } from '../../types'
import type { IConversationState } from '../interface'

export class UrgencyState implements IConversationState {
  readonly id = 'urgency'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.trim()
    const optionNum = trimmed.replace(/[^0-9]/g, '')

    if (!optionNum || optionNum < '1' || optionNum > '3') {
      const intent: StateIntent = {
        validationError: '⚠️ Por favor, elegí una opción: 1, 2 o 3.',
      }

      return {
        intent,
        isValid: false,
      }
    }

    const priorityMap: Record<string, string> = {
      '1': 'high',      // Urgente
      '2': 'medium',    // Esta semana
      '3': 'low',       // Sin apuro
    }

    const priorityLabelMap: Record<string, string> = {
      'high': 'Urgente',
      'medium': 'Esta semana',
      'low': 'Sin apuro',
    }

    const priority = priorityMap[optionNum]

    console.log('[UrgencyState] Selected priority:', priority);

    const intent: StateIntent = {
      data: {
        priority,           // para UI
        priorityLabel: priorityLabelMap[priority],  // para UI
        urgency: priority,  // para scoring
      },
      nextState: 'description',  // Go to description for detail
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    return `⚡ *URGENCIA*

¿Con qué urgencia lo necesitás?

1️⃣ Urgente
2️⃣ Esta semana
3️⃣ Sin apuro`
  }

  getOptions(context: ConversationContext): string[] | undefined {
    return [
      '1️⃣ Urgente',
      '2️⃣ Esta semana',
      '3️⃣ Sin apuro',
    ]
  }
}

export default UrgencyState