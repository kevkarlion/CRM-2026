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
    // First message in conversation, any input is valid
    const intent: StateIntent = {
      data: {},
      nextState: 'name',
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
      greeting = '¡Buenos días! ☀️'
    } else if (hour < 18) {
      greeting = '¡Buenas tardes! 🌤️'
    } else {
      greeting = '¡Buenas noches! 🌙'
    }

    return `${greeting} 👋🤖 Soy el asistente virtual de Rolo Climatización. Te voy a hacer algunas preguntas para gestionar tu solicitud de servicio.`
  }

  getOptions(context: ConversationContext): string[] {
    return undefined
  }
}

export default GreetingState