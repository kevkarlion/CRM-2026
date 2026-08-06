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
        terminal: true, // Directo a terminal - no waiting_operator
        data: {
          confirmed: true,
          complete: true,
        },
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
      // For customers: restart from service_type - NO greeting, they already know who they are
      // This state is now customer-specific (from state registry fix)
      console.log('[Summary] Correct requested - restarting from service_type (no greeting)');
      
      const intent: StateIntent = {
        // Go back to service_type - customer flow, no greeting shown
        nextState: 'service_type',
      }

      return {
        intent,
        isValid: true,
      }
    }
    
    // Check if user entered a number that's not 1 or 2
    const optionNum = trimmed.replace(/[^0-9]/g, '')
    if (optionNum && optionNum !== '1' && optionNum !== '2') {
      const intent: StateIntent = {
        validationError: '⚠️ Por favor, elegí una de las opciones disponibles: 1 o 2.',
      }

      return {
        intent,
        isValid: false,
      }
    }

    // Invalid input - ask again
    const intent: StateIntent = {
      // Stay in summary state and re-show the message
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
    const priorityLabel = context.get<string>('priorityLabel') || 'No especificada'

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

⏰ *Prioridad:*
${priorityLabel}

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