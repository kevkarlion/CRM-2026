/**
 * Priority State (Customer)
 * 
 * Asks customer about their urgency level.
 */

import type { ConversationContext } from '../../context'
import type { ProcessResult, StateIntent } from '../../types'
import type { IConversationState } from '../interface'

export class PriorityState implements IConversationState {
  readonly id = 'priority'

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
      '1': 'urgent',
      '2': 'this_week',
      '3': 'flexible',
    }

    const priorityLabelMap: Record<string, string> = {
      'urgent': 'Urgente',
      'this_week': 'Esta semana',
      'flexible': 'Sin apuro',
    }

    const priority = priorityMap[optionNum]

    const intent: StateIntent = {
      data: {
        priority,
        priorityLabel: priorityLabelMap[priority],
      },
      nextState: 'description',  // Go to description first, then summary
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    return `⏰ ¿Cuándo necesitás el servicio?`
  }

  getOptions(context: ConversationContext): string[] | undefined {
    return [
      '1️⃣ Lo antes posible',
      '2️⃣ Esta semana',
      '3️⃣ Sin apuro',
    ]
  }
}

export default PriorityState