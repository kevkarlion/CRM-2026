/**
 * General Query State
 * 
 * Captures general queries from customers.
 * Branch: Option 6 - Otra consulta
 */

import type { ConversationContext } from '../../context'
import type { ProcessResult, StateIntent } from '../../types'
import type { IConversationState } from '../interface'

export class GeneralQueryState implements IConversationState {
  readonly id = 'general_query'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.trim()
    
    console.log('[GeneralQueryState] process called with input:', trimmed);

    // Check for "corregir" or "0"
    const lowerInput = trimmed.toLowerCase()
    if (lowerInput === 'corregir' || lowerInput === '0') {
      console.log('[GeneralQueryState] Customer wants to correct - going back to greeting');
      const intent: StateIntent = {
        nextState: 'greeting_personalized',
      }
      return {
        intent,
        isValid: true,
      }
    }

    // Validate input is not empty
    if (trimmed.length < 3) {
      const intent: StateIntent = {
        validationError: '⚠️ Por favor, contános brevemente qué querés consultar (mínimo 3 caracteres).',
      }
      return {
        intent,
        isValid: false,
      }
    }

    // Save general query
    console.log('[GeneralQueryState] Saving general query:', trimmed);
    const intent: StateIntent = {
      data: {
        generalQuery: trimmed,
      },
      nextState: 'name',
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    return `🩵 *OTRA CONSULTA*

Contános brevemente qué querés consultar.

Un asesor te responderá a la brevedad.`
  }

  getOptions(context: ConversationContext): string[] | undefined {
    return [
      '0️⃣ Corregir',
    ]
  }
}

export default GeneralQueryState