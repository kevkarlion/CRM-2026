/**
 * Quote Work State
 * 
 * Captures what the customer wants to quote.
 * Branch: Option 4 - Cotizaciones
 */

import type { ConversationContext } from '../../context'
import type { ProcessResult, StateIntent } from '../../types'
import type { IConversationState } from '../interface'

export class QuoteWorkState implements IConversationState {
  readonly id = 'quote_work'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.trim()
    
    console.log('[QuoteWorkState] process called with input:', trimmed);

    // Check for "corregir" or "0"
    const lowerInput = trimmed.toLowerCase()
    if (lowerInput === 'corregir' || lowerInput === '0') {
      console.log('[QuoteWorkState] Customer wants to correct - going back to greeting');
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
        validationError: '⚠️ Por favor, describí el equipo o trabajo que querés cotizar (mínimo 3 caracteres).',
      }
      return {
        intent,
        isValid: false,
      }
    }

    // Save quote work description
    console.log('[QuoteWorkState] Saving quote work:', trimmed);
    const intent: StateIntent = {
      data: {
        quoteWork: trimmed,
      },
      nextState: 'name',
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    return `🟡 *COTIZACIÓN*

¿Qué equipo o trabajo querés cotizar?

Contános brevemente los detalles para que un asesor pueda armarte el presupuesto.`
  }

  getOptions(context: ConversationContext): string[] | undefined {
    return [
      '0️⃣ Corregir',
    ]
  }
}

export default QuoteWorkState