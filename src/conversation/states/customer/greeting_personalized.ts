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

    console.log('[GreetingPersonalized] process called with input:', input, '| optionNum:', optionNum);

    // Check if customer already has data (e.g., after "corregir" in summary)
    const existingServiceType = context.get<string>('serviceType')
    const customerName = context.get<string>('customerName')
    
    console.log('[GreetingPersonalized] existingServiceType:', existingServiceType, '| customerName:', customerName);
    
    // If customer already has service type and name, they're returning from correction
    // Skip to summary to review their corrected info
    if (existingServiceType && customerName && !optionNum) {
      console.log('[GreetingPersonalized] Customer returning with existing data - skipping to summary');
      const intent: StateIntent = {
        nextState: 'summary',
      }
      return {
        intent,
        isValid: true,
      }
    }

    // If user selected an option (1-5), save service type and go to address_confirm
    console.log('[GreetingPersonalized] Checking option:', optionNum, '| valid?', optionNum >= '1' && optionNum <= '5');
    if (optionNum && optionNum >= '1' && optionNum <= '5') {
      const serviceType = SERVICE_OPTIONS[optionNum]
      console.log('[GreetingPersonalized] Selected serviceType:', serviceType);
      
      if (serviceType) {
        console.log('[GreetingPersonalized] → Going to address_confirm');
        const intent: StateIntent = {
          data: {
            serviceType,
            serviceTypeLabel: SERVICE_LABELS[serviceType],
          },
          nextState: 'address_confirm',  // Skip service_type since they already chose
        }

        return {
          intent,
          isValid: true,
        }
      }
    }

    // Otherwise, stay in greeting and ask for valid option
    console.log('[GreetingPersonalized] Invalid input - showing validation error');
    const intent: StateIntent = {
      validationError: '⚠️ Por favor, elegí una opción del 1 al 5.',
    }

    return {
      intent,
      isValid: false,
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

    const customerName = context.get<string>('customerName')
    
    return `${greeting}${customerName ? `, *${customerName}*` : ''} 👋

Soy Rolito, el asistente virtual de *Rolo Climatización S.R.L*. 🤖

¿En qué podemos ayudarte hoy?`
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