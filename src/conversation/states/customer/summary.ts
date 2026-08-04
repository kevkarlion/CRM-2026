/**
 * Summary State
 * 
 * Shows collected info: name, service, address, description.
 * Options: 1. Confirmar, 2. Corregir
 */

import type { ConversationContext } from '../../context'
import type { ProcessResult, StateIntent } from '../../types'
import type { IConversationState } from '../interface'

export class SummaryState implements IConversationState {
  readonly id = 'summary'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.toLowerCase().trim()
    const normalized = trimmed.replace(/[,.]/g, '')

    // Check for confirmation
    const confirmKeywords = ['si', 'sí', 'correcto', 'si,', 'sí,', 'correcto', '1', 'si ', 'sí ']
    const isConfirmed = confirmKeywords.some(k => normalized === k || normalized.startsWith(k + ' ')) ||
                        normalized === '1'

    if (isConfirmed) {
      const intent: StateIntent = {
        nextState: 'waiting_operator',
      }

      return {
        intent,
        isValid: true,
      }
    }

    // Check for correction - go back to service type
    const correctKeywords = ['corregir', 'cambiar', 'no', 'incorrecto', '2']
    const wantsCorrection = correctKeywords.some(k => normalized === k || normalized.startsWith(k + ' ')) ||
                            normalized === '2'

    if (wantsCorrection) {
      const intent: StateIntent = {
        nextState: 'service_type',
        data: {
          restarted: true,
        },
      }

      return {
        intent,
        isValid: true,
      }
    }

    // Invalid input - ask again
    const intent: StateIntent = {
      validationError: '⚠️ No entendí tu respuesta. Por favor, respondé "1" para confirmar o "2" para corregir.',
    }

    return {
      intent,
      isValid: false,
    }
  }

  getMessage(context: ConversationContext): string {
    const name = context.get<string>('customerName') || 'Cliente'
    const serviceType = context.get<string>('serviceTypeLabel') || context.get<string>('serviceType') || 'Servicio'
    const address = context.get<string>('address') || ''
    const locality = context.get<string>('locality') || ''
    const province = context.get<string>('province') || ''
    const description = context.get<string>('description') || 'Sin descripción'

    // Build address with locality and province
    let fullAddress = address
    if (locality || province) {
      fullAddress = `${address}${locality ? `, ${locality}` : ''}${province ? `, ${province}` : ''}`
    }

    return `✅ *Resumen de tu solicitud*

👤 *Nombre:*
${name}

🛠️ *Servicio:*
${serviceType}

📍 *Dirección:*
${fullAddress || 'No especificada'}

📝 *Descripción:*
${description}

¿La información es correcta?`
  }

  getOptions(context: ConversationContext): string[] | undefined {
    return [
      '1️⃣ Confirmar',
      '2️⃣ Corregir',
    ]
  }
}

export default SummaryState