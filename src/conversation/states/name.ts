/**
 * Name State
 * 
 * Collects the user's name and validates it's not empty.
 */

import type { ConversationContext } from '../context'
import type { ProcessResult, StateIntent } from '../types'
import type { IConversationState } from './interface'

export class NameState implements IConversationState {
  readonly id = 'name'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.trim()

    // Validate name is not empty
    if (!trimmed || trimmed.length === 0) {
      const intent: StateIntent = {
        validationError: 'Por favor, ingresa tu nombre para continuar.',
      }

      return {
        intent,
        isValid: false,
      }
    }

    // Validate minimum length (2 characters)
    if (trimmed.length < 2) {
      const intent: StateIntent = {
        validationError: 'El nombre debe tener al menos 2 caracteres.',
      }

      return {
        intent,
        isValid: false,
      }
    }

    const intent: StateIntent = {
      data: {
        customerName: trimmed,
      },
      nextState: 'service',
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    return '¿Cómo te llamás? 🤔'
  }

  getOptions(context: ConversationContext): string[] {
    return undefined // No options for name - free text
  }
}

export default NameState