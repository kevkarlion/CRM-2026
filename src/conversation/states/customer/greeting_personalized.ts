/**
 * Personalized Greeting State
 * 
 * First state in customer flow - personalized greeting using customer name from context.
 * If user selects an option (1-5), advances directly to address_confirm.
 * Otherwise, advances to service_type for detailed selection.
 */

import type { ConversationContext } from '../../context'
import type { ProcessResult, StateIntent } from '../../types'
import type { IConversationState } from '../interface'

// Service type options mapping (same as service_type state)
const SERVICE_OPTIONS: Record<string, string> = {
  '1': 'repair',
  '2': 'maintenance',
  '3': 'installation',
  '4': 'previous_work',
  '5': 'other',
}

const SERVICE_LABELS: Record<string, string> = {
  'repair': 'Reparación',
  'maintenance': 'Mantenimiento',
  'installation': 'Instalación',
  'previous_work': 'Consulta trabajo anterior',
  'other': 'Otro',
}

export class GreetingPersonalizedState implements IConversationState {
  readonly id = 'greeting_personalized'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.trim()
    const optionNum = trimmed.replace(/[^0-9]/g, '')

    // If user selected an option (1-5), save service type and go to address_confirm
    if (optionNum && optionNum >= '1' && optionNum <= '5') {
      const serviceType = SERVICE_OPTIONS[optionNum]
      
      if (serviceType) {
        const intent: StateIntent = {
          data: {
            serviceType,
            serviceTypeLabel: SERVICE_LABELS[serviceType],
          },
          nextState: 'address_confirm',
        }

        return {
          intent,
          isValid: true,
        }
      }
    }

    // Otherwise, advance to service_type for detailed selection
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