/**
 * Confirmation State
 * 
 * Final state - shows summary of collected data and confirms with user.
 * If user confirms, conversation is complete. Otherwise, restarts.
 */

import type { ConversationContext } from '../context'
import type { ProcessResult, StateIntent } from '../types'
import type { IConversationState } from './interface'

// Confirmation keywords
const CONFIRM_KEYWORDS = ['si', 'sí', 'correcto', 'si,', 'sí,', 'correcto', '1', 'si ', 'sí ']
const CORRECT_KEYWORDS = ['si', 'sí', 'correcto', 'yes', 'si,', 'sí,', 'correcto,', '1', 'si ', 'sí ']
const RESTART_KEYWORDS = ['no', 'incorrecto', 'cambiar', '2']

export class ConfirmationState implements IConversationState {
  readonly id = 'confirmation'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.toLowerCase().trim()
    const normalized = trimmed.replace(/[,.]/g, '')

    // Check for confirmation
    const isConfirmed = CONFIRM_KEYWORDS.some(k => normalized === k || normalized.startsWith(k + ' '))

    if (isConfirmed || CORRECT_KEYWORDS.some(k => normalized === k || normalized.startsWith(k + ' '))) {
      const intent: StateIntent = {
        terminal: true,
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

    // Check for rejection/restart
    const wantsRestart = RESTART_KEYWORDS.some(k => normalized === k || normalized.startsWith(k + ' '))

    if (wantsRestart) {
      const intent: StateIntent = {
        nextState: 'greeting',
        data: {
          restarted: true,
        },
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

    // Invalid input - ask again (re-show the summary)
    const intent: StateIntent = {
      // Stay in confirmation state and show the message again
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
    const priority = context.get<string>('priorityLabel') || context.get<string>('priority') || 'No especificado'
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

📅 *Necesidad:*
${priority}

📝 *Descripción:*
${description}

¿La información es correcta?`
  }

  getOptions(context: ConversationContext): string[] {
    return [
      '1️⃣ Sí',
      '2️⃣ Corregir',
    ]
  }
}

export default ConfirmationState