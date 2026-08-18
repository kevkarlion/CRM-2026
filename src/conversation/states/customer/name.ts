/**
 * Name State
 * 
 * Captures customer name for the visit/service request.
 * Used in multiple branches (service, quote, parts, general).
 */

import type { ConversationContext } from '../../context'
import type { ProcessResult, StateIntent } from '../../types'
import type { IConversationState } from '../interface'

export class NameState implements IConversationState {
  readonly id = 'name'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.trim()
    
    console.log('[NameState] process called with input:', trimmed);

    // Check for "corregir" or "corregir nombre" - go back to previous step
    const lowerInput = trimmed.toLowerCase()
    if (lowerInput === 'corregir' || lowerInput === 'corregir nombre' || lowerInput === '0') {
      console.log('[NameState] Customer wants to correct - going back');
      const intent: StateIntent = {
        nextState: this.getPreviousState(context),
      }
      return {
        intent,
        isValid: true,
      }
    }

    // Validate name is not empty and has reasonable length
    if (trimmed.length < 2) {
      const intent: StateIntent = {
        validationError: '⚠️ Por favor, ingresá un nombre válido (al menos 2 caracteres).',
      }
      return {
        intent,
        isValid: false,
      }
    }

    // Save name to context
    console.log('[NameState] Saving customer name:', trimmed);
    const intent: StateIntent = {
      data: {
        customerName: trimmed,
      },
      nextState: 'summary',
    }

    return {
      intent,
      isValid: true,
    }
  }

  private getPreviousState(context: ConversationContext): string {
    const serviceType = context.get<string>('serviceType')
    
    // Go back to the appropriate previous state based on service type
    if (serviceType === 'budget') {
      return 'quote_work'
    }
    if (serviceType === 'spare_parts') {
      return 'spare_part'
    }
    if (serviceType === 'other') {
      return 'general_query'
    }
    // For service types (1-3), go back to address
    return 'address_confirm'
  }

  getMessage(context: ConversationContext): string {
    const serviceType = context.get<string>('serviceTypeLabel') || 'servicio'
    
    return `📝 ¿Cuál es tu nombre para agendar la visita?`
  }

  getOptions(context: ConversationContext): string[] | undefined {
    return [
      '0️⃣ Corregir',
    ]
  }
}

export default NameState