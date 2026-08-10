/**
 * Greeting State
 * 
 * First state in the conversation - provides time-based greeting
 * and explains the process.
 */

import type { ConversationContext } from '../context'
import type { ProcessResult, StateIntent } from '../types'
import type { IConversationState } from './interface'

export class GreetingState implements IConversationState {
  readonly id = 'greeting'

  process(input: string, context: ConversationContext): ProcessResult {
    // Take the name directly from the first input
    const trimmed = input.trim()
    
    if (!trimmed || trimmed.length < 2) {
      const intent: StateIntent = {
        validationError: '⚠️ Por favor, ingresa tu nombre para continuar.',
      }

      return {
        intent,
        isValid: false,
      }
    }

    // Store name and go directly to service
    const intent: StateIntent = {
      data: {
        customerName: trimmed,
      },
      nextState: 'service',
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    // Get hour in Argentina timezone (UTC-3) - approximate by subtracting 3 from UTC
    const utcHour = new Date().getHours()
    const argentinaHour = (utcHour - 3 + 24) % 24  // Convert UTC to Argentina time
    
    let greeting: string

    // 20:00 - 05:59: Buenas noches
    // 06:00 - 11:59: Buenos días
    // 12:00 - 19:59: Buenas tardes
    if (argentinaHour >= 20 || argentinaHour < 6) {
      greeting = '🌙 Buenas noches'
    } else if (argentinaHour < 12) {
      greeting = '🌞 Buenos días'
    } else {
      greeting = '☀️ Buenas tardes'
    }

    return `${greeting} 👋

Soy el asistente virtual de *Rolo Climatización S.R.L*.

Voy a hacerte unas preguntas para registrar tu solicitud y derivarla rápidamente al asesor correspondiente.

¿cómo te llamás?`
  }

  getOptions(context: ConversationContext): string[] {
    return undefined
  }
}

export default GreetingState