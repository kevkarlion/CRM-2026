/**
 * Spare Part State
 * 
 * Captures the spare part information the customer is looking for.
 * Branch: Option 5 - Venta de Repuestos
 */

import type { ConversationContext } from '../../context'
import type { ProcessResult, StateIntent } from '../../types'
import type { IConversationState } from '../interface'

export class SparePartState implements IConversationState {
  readonly id = 'spare_part'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.trim()
    
    console.log('[SparePartState] process called with input:', trimmed);

    // Check for "corregir" or "0"
    const lowerInput = trimmed.toLowerCase()
    if (lowerInput === 'corregir' || lowerInput === '0') {
      console.log('[SparePartState] Customer wants to correct - going back to greeting');
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
        validationError: '⚠️ Por favor, indicá el repuesto, marca y modelo (mínimo 3 caracteres).',
      }
      return {
        intent,
        isValid: false,
      }
    }

    // Save spare part info
    console.log('[SparePartState] Saving spare part:', trimmed);
    const intent: StateIntent = {
      data: {
        sparePart: trimmed,
      },
      nextState: 'name',
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    return `🔵 *REPUESTOS*

Indicános el repuesto, marca y modelo del equipo.

Ejemplo: "Filtro de aire Daikin 9000 BTU" o "Placa controladora Samsung"`
  }

  getOptions(context: ConversationContext): string[] | undefined {
    return [
      '0️⃣ Corregir',
    ]
  }
}

export default SparePartState