/**
 * Personalized Greeting State
 * 
 * First state in customer flow - personalized greeting using customer name from context.
 * Auto-advances to service_type.
 */

import type { ConversationContext } from '../../context'
import type { ProcessResult, StateIntent } from '../../types'
import type { IConversationState } from '../interface'

export class GreetingPersonalizedState implements IConversationState {
  readonly id = 'greeting_personalized'

  process(input: string, context: ConversationContext): ProcessResult {
    // Customer flow greeting doesn't require input processing
    // Just advance to next state
    const intent: StateIntent = {
      nextState: 'service_type',
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    const customerName = context.get<string>('customerName')
    
    // Get hour in Argentina timezone (UTC-3)
    const utcHour = new Date().getHours()
    const argentinaHour = (utcHour - 3 + 24) % 24

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

¡Bienvenido de nuevo, *${customerName || 'cliente'}*!

Soy el asistente virtual de *Rolo Climatizaciones*.

¿En qué puedo ayudarte hoy?`
  }

  getOptions(context: ConversationContext): string[] | undefined {
    return [
      '1️⃣ Reparación',
      '2️⃣ Mantenimiento',
      '3️⃣ Instalación',
      '4️⃣ Consulta trabajo anterior',
      '5️⃣ Otro',
    ]
  }
}

export default GreetingPersonalizedState