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
    const hour = new Date().getHours()
    let greeting: string

    if (hour < 12) {
      greeting = '🌞 Buenos días'
    } else if (hour < 20) {
      greeting = '☀️ Buenas tardes'
    } else {
      greeting = '🌙 Buenas noches'
    }

    return `${greeting} 👋

Soy el asistente virtual de *Rolo Climatizaciones*.

Voy a hacerte unas preguntas para registrar tu solicitud y derivarla rápidamente al asesor correspondiente.

¿cómo te llamás?`
  }

  getOptions(context: ConversationContext): string[] {
    return undefined
  }
}

export default GreetingState