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

    // Get existing address from context (check both with and without customer prefix)
    const existingAddress = context.get<string>('customerAddress') || context.get<string>('address') || context.get<string>('location')
    const existingLocality = context.get<string>('customerLocality') || context.get<string>('locality')
    const existingProvince = context.get<string>('customerProvince') || context.get<string>('province')

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
      // Also save the address to context so it can be saved to lead/client
      
      // Save address to CLIENT in database (if not already saved) - fire and forget
      const clientId = context.get<string>('clientId');
      const tenantId = context.get<string>('tenantId');
      if (clientId && tenantId && existingAddress) {
        context.updateClientAddress(clientId, tenantId, existingAddress, existingLocality, existingProvince)
          .then(() => console.log('[AddressConfirm] Confirmed address saved to client:', clientId))
          .catch(err => console.error('[AddressConfirm] Failed to save address:', err));
      }
      
      const intent: StateIntent = {
        nextState: 'priority', // FIXED: was 'description'
        data: {
          address: existingAddress,
          locality: existingLocality,
          province: existingProvince,
        },
      }

      return {
        intent,
        isValid: true,
      }
    }

    // User entered new address (valid text) - save as-is, no parsing
    // Store as single text field (address only, no locality/province separated)
    if (isNewAddress) {
      const addressInput = input.trim();

      // Save address to CLIENT in database - fire and forget
      const clientId = context.get<string>('clientId');
      const tenantId = context.get<string>('tenantId');
      if (clientId && tenantId) {
        context.updateClientAddress(clientId, tenantId, addressInput)
          .then(() => console.log('[AddressConfirm] Address saved to client:', clientId))
          .catch(err => console.error('[AddressConfirm] Failed to save address:', err));
      }

      // Save as free text - NO parsing
      const intent: StateIntent = {
        data: {
          address: addressInput,  // Guardar todo junto como texto libre
        },
        nextState: 'priority',
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
    // Get customer address from context (with customer prefix)
    const existingAddress = context.get<string>('customerAddress') || context.get<string>('address')
    const existingLocality = context.get<string>('customerLocality') || context.get<string>('locality')
    const existingProvince = context.get<string>('customerProvince') || context.get<string>('province')

    // Build full address display
    let fullAddress = existingAddress || ''
    if (existingLocality) {
      fullAddress = `${fullAddress}${fullAddress ? ', ' : ''}${existingLocality}`
    }
    if (existingProvince) {
      fullAddress = `${fullAddress}${fullAddress ? ', ' : ''}${existingProvince}`
    }

    if (fullAddress) {
      return `📍 ¿La dirección donde vamos a trabajar es la misma que tenés registrada?

📍 *${fullAddress}*

1️⃣ Sí, es esa dirección
2️⃣ Voy a dar otra dirección`
    }

    // No existing address - ask for it
    return `📍 ¿Cuál es la dirección donde realizaremos el servicio?

(Incluí calle, localidad y provincia)`
  }

  getOptions(context: ConversationContext): string[] | undefined {
    const existingAddress = context.get<string>('customerAddress') || context.get<string>('address')
    const askingNewAddress = context.get<boolean>('askingNewAddress')

    // If we're asking for a new address (user chose "2"), don't show options
    if (askingNewAddress) {
      return undefined // Free text input
    }

    if (existingAddress) {
      return [
        '1️⃣ Sí, es esa dirección',
        '2️⃣ Voy a dar otra dirección',
      ]
    }

    return undefined // Free text address
  }
}

export default AddressConfirmState