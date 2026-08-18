/**
 * Detail State (for Service Flow)
 * 
 * Collects detailed description of the service request.
 * Branch: Options 1-3 (Mantenimiento, Reparación, Instalación)
 */

import type { ConversationContext } from '../../context'
import type { ProcessResult, StateIntent } from '../../types'
import type { IConversationState } from '../interface'

const MIN_DETAIL_LENGTH = 5

export class DetailState implements IConversationState {
  readonly id = 'detail'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.trim()

    // Check for "corregir" or "0"
    const lowerInput = trimmed.toLowerCase()
    if (lowerInput === 'corregir' || lowerInput === '0') {
      console.log('[DetailState] Customer wants to correct - going back to urgency');
      const intent: StateIntent = {
        nextState: 'urgency',
      }
      return {
        intent,
        isValid: true,
      }
    }

    // Validate minimum length
    if (!trimmed || trimmed.length < MIN_DETAIL_LENGTH) {
      const intent: StateIntent = {
        validationError: `⚠️ Por favor, contanos brevemente la falla o trabajo (mínimo ${MIN_DETAIL_LENGTH} caracteres).`,
      }

      return {
        intent,
        isValid: false,
      }
    }

    console.log('[DetailState] Saving detail:', trimmed);
    const intent: StateIntent = {
      data: {
        description: trimmed,
      },
      nextState: 'address_confirm',  // After detail, ask for address
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    return `📝 *DETALLE*

Contanos brevemente la falla o trabajo que necesitás.

Ejemplo: "No enciende el equipo", "Service preventivo anual", etc.`
  }

  getOptions(context: ConversationContext): string[] | undefined {
    return [
      '0️⃣ Corregir',
    ]
  }
}

export default DetailState