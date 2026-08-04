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

    if (existingAddress && (isConfirm || normalized === '')) {
      // User confirmed existing address - proceed to description
      const intent: StateIntent = {
        nextState: 'description',
      }

      return {
        intent,
        isValid: true,
      }
    }

    if (isNewAddress || isReject || !existingAddress) {
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

      const intent: StateIntent = {
        data: {
          address: street,
          locality,
          province,
          fullAddress: addressInput,
        },
        nextState: 'description',
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