/**
 * Address Confirm State
 * 
 * Checks if context has existing address from customer data.
 * If yes: asks for confirmation.
 * If no: asks for full address.
 */

import type { ConversationContext } from '../../context'
import type { ProcessResult, StateIntent } from '../../types'
import type { IConversationState } from '../interface'

export class AddressConfirmState implements IConversationState {
  readonly id = 'address_confirm'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.trim().toLowerCase().replace(/[,.]/g, '')
    const normalized = trimmed.replace(/[^0-9]/g, '')

    // Get existing address from context
    const existingAddress = context.get<string>('address')
    const existingLocality = context.get<string>('locality')
    const existingProvince = context.get<string>('province')

    // Build full address
    let fullAddress = existingAddress || ''
    if (existingLocality) {
      fullAddress = `${fullAddress}${fullAddress ? ', ' : ''}${existingLocality}`
    }
    if (existingProvince) {
      fullAddress = `${fullAddress}${fullAddress ? ', ' : ''}${existingProvince}`
    }

    // Handle "yes" responses (confirm address)
    const confirmKeywords = ['si', 'sí', 'correcto', 'si,', 'sí,', 'correcto', '1', 'si ', 'sí ']
    const isConfirm = confirmKeywords.some(k => normalized === k || normalized.startsWith(k + ' ')) ||
                      ['1', 's'].includes(normalized)

    // Handle "no" responses (need to enter new address)
    const rejectKeywords = ['no', 'incorrecto', 'cambiar', 'distinto', '2']
    const isReject = rejectKeywords.some(k => normalized === k || normalized.startsWith(k + ' ')) ||
                     normalized === '2'

    // Check if user entered new address (not a yes/no response)
    const isNewAddress = !isConfirm && !isReject && trimmed.length >= 5

    // FIX: If user chose "2" (reject), ask for new address instead of treating "2" as address
    if (existingAddress && isReject) {
      const intent: StateIntent = {
        // Stay in same state, but ask for new address
        validationError: '📝 Ingresá la nueva dirección (calle, localidad, provincia):',
        data: {
          askingNewAddress: true, // Flag to hide options in getOptions
        },
      }

      return {
        intent,
        isValid: false,
      }
    }

    // No existing address - must ask for it
    if (!existingAddress && !isNewAddress) {
      const intent: StateIntent = {
        validationError: '📝 Ingresá la dirección donde realizaremos el servicio\n(Incluí calle, localidad y provincia):',
      }

      return {
        intent,
        isValid: false,
      }
    }

    if (existingAddress && (isConfirm || normalized === '')) {
      // User confirmed existing address - proceed to priority (when needed)
      const intent: StateIntent = {
        nextState: 'priority', // FIXED: was 'description'
      }

      return {
        intent,
        isValid: true,
      }
    }

    // User entered new address (valid text) - parse and process it
    if (isNewAddress) {
      // User wants to enter new address - parse it
      const addressInput = isNewAddress ? trimmed : input.trim()

      // Try to parse address components (separated by commas)
      const parts = addressInput.split(',').map(p => p.trim()).filter(p => p.length > 0)

      let street = addressInput
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

      // NEW: Ask priority (when do you need the service)
      const intent: StateIntent = {
        data: {
          address: street,
          locality,
          province,
          fullAddress: addressInput,
          askingNewAddress: false, // Clear the flag
        },
        nextState: 'priority', // FIXED: was 'description'
      }

      return {
        intent,
        isValid: true,
      }
    }

    // Invalid input - ask again
    const intent: StateIntent = {
      validationError: '⚠️ No entendí tu respuesta. Respondé "1" para confirmar la dirección o "2" para ingresar una nueva.',
    }

    return {
      intent,
      isValid: false,
    }
  }

  getMessage(context: ConversationContext): string {
    const existingAddress = context.get<string>('address')
    const existingLocality = context.get<string>('locality')
    const existingProvince = context.get<string>('province')

    // Build full address display
    let fullAddress = existingAddress || ''
    if (existingLocality) {
      fullAddress = `${fullAddress}${fullAddress ? ', ' : ''}${existingLocality}`
    }
    if (existingProvince) {
      fullAddress = `${fullAddress}${fullAddress ? ', ' : ''}${existingProvince}`
    }

    if (fullAddress) {
      return `📍 ¿Confirmás esta dirección?

${fullAddress}`
    }

    // No existing address - ask for it
    return `📍 ¿Cuál es la dirección donde realizaremos el servicio?

(Incluí calle, localidad y provincia)`
  }

  getOptions(context: ConversationContext): string[] | undefined {
    const existingAddress = context.get<string>('address')
    const askingNewAddress = context.get<boolean>('askingNewAddress')

    // If we're asking for a new address (user chose "2"), don't show options
    if (askingNewAddress) {
      return undefined // Free text input
    }

    if (existingAddress) {
      return [
        '1️⃣ Sí, confirmar',
        '2️⃣ Ingresar otra dirección',
      ]
    }

    return undefined // Free text address
  }
}

export default AddressConfirmState