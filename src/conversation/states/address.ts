/**
 * Address State
 * 
 * Parses address into components: street, locality, province.
 * Expects input in format: "Calle, Localidad, Provincia"
 */

import type { ConversationContext } from '../context'
import type { ProcessResult, StateIntent } from '../types'
import type { IConversationState } from './interface'

export class AddressState implements IConversationState {
  readonly id = 'address'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.trim()

    // Validate not empty
    if (!trimmed || trimmed.length < 5) {
      const intent: StateIntent = {
        validationError: '⚠️ Por favor, ingresa una dirección válida.',
      }

      return {
        intent,
        isValid: false,
      }
    }

    // Try to parse address components (separated by commas)
    const parts = trimmed.split(',').map(p => p.trim()).filter(p => p.length > 0)

    let street = trimmed
    let locality = ''
    let province = ''

    if (parts.length >= 3) {
      street = parts[0]
      locality = parts[1]
      province = parts[2]
    } else if (parts.length === 2) {
      street = parts[0]
      locality = parts[1]
    }

    const intent: StateIntent = {
      data: {
        address: street,
        locality,
        province,
        fullAddress: trimmed,
      },
      nextState: 'priority',
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    return `📍 ¿Cuál es la dirección donde realizaremos el servicio?\n\n(Incluí calle, localidad y provincia)`
  }

  getOptions(context: ConversationContext): string[] {
    return undefined // Free text address
  }
}

export default AddressState