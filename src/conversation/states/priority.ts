/**
 * Priority State
 * 
 * Collects when the user needs the service.
 * Options: 1=ASAP, 2=This week, 3=Next week
 */

import type { ConversationContext } from '../context'
import type { ProcessResult, StateIntent } from '../types'
import type { IConversationState } from './interface'

// Priority options mapping
const PRIORITY_OPTIONS: Record<string, string> = {
  '1': 'asap',
  '2': 'this_week',
  '3': 'next_week',
}

const PRIORITY_LABELS: Record<string, string> = {
  'asap': 'Lo antes posible',
  'this_week': 'Esta semana',
  'next_week': 'La próxima semana',
}

export class PriorityState implements IConversationState {
  readonly id = 'priority'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.trim()

    // Validate input is a number between 1-3
    const optionNum = trimmed.replace(/[^0-9]/g, '')

    if (!optionNum || optionNum < '1' || optionNum > '3') {
      const intent: StateIntent = {
        validationError: 'Por favor, seleccioná una opción del 1 al 3.',
      }

      return {
        intent,
        isValid: false,
      }
    }

    const priority = PRIORITY_OPTIONS[optionNum]

    if (!priority) {
      const intent: StateIntent = {
        validationError: 'Opción inválida. Por favor, elegí un número del 1 al 3.',
      }

      return {
        intent,
        isValid: false,
      }
    }

    const intent: StateIntent = {
      data: {
        priority,
        priorityLabel: PRIORITY_LABELS[priority],
      },
      nextState: 'description',
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    return '¿Cuándo necesitás el servicio?'
  }

  getOptions(context: ConversationContext): string[] {
    return [
      '1 - Hoy',
      '2 - Esta semana',
      '3 - No tengo apuro',
    ]
  }
}

/**
 * Get the label for a priority
 */
export function getPriorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority] || priority
}

export default PriorityState