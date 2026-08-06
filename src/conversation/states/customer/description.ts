/**
 * Description State (Customer)
 * 
 * Collects free-text description for customer flow.
 * Goes to 'summary' after description is collected.
 */

import type { ConversationContext } from '../../context'
import type { ProcessResult, StateIntent } from '../../types'
import type { IConversationState } from '../interface'

const MIN_DESCRIPTION_LENGTH = 10

export class DescriptionState implements IConversationState {
  readonly id = 'description'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.trim()

    // Validate minimum length
    if (!trimmed || trimmed.length < MIN_DESCRIPTION_LENGTH) {
      const intent: StateIntent = {
        validationError: `⚠️ Por favor, ingresa más detalles (mínimo ${MIN_DESCRIPTION_LENGTH} caracteres).`,
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
      nextState: 'summary',  // Customer flow goes to summary
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    return `📝 Describí brevemente el problema o servicio que necesitás:`
  }

  getOptions(context: ConversationContext): string[] | undefined {
    return undefined // Free text
  }
}

export default DescriptionState