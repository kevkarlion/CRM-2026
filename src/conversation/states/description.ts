/**
 * Description State
 * 
 * Collects free-text description of the issue/service needed.
 * Validates minimum length.
 */

import type { ConversationContext } from '../context'
import type { ProcessResult, StateIntent } from '../types'
import type { IConversationState } from './interface'

const MIN_DESCRIPTION_LENGTH = 10

export class DescriptionState implements IConversationState {
  readonly id = 'description'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.trim()

    // Validate minimum length
    if (!trimmed || trimmed.length < MIN_DESCRIPTION_LENGTH) {
      const intent: StateIntent = {
        validationError: `Por favor, ingresa más detalles (mínimo ${MIN_DESCRIPTION_LENGTH} caracteres).`,
      }

      return {
        intent,
        isValid: false,
      }
    }

    const intent: StateIntent = {
      data: {
        description: trimmed,
      },
      nextState: 'confirmation',
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    // This state collects description, so this message is shown after valid input
    // before transitioning to confirmation
    return '¿Confirmás los siguientes datos?'
  }

  getOptions(context: ConversationContext): string[] {
    return undefined
  }
}

export default DescriptionState