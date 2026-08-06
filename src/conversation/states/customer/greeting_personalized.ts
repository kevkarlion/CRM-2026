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

    // Check if customer already has data (e.g., after "corregir" in summary)
    const existingServiceType = context.get<string>('serviceType')
    const customerName = context.get<string>('customerName')
    
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
    if (optionNum && optionNum >= '1' && optionNum <= '5') {
      const serviceType = SERVICE_OPTIONS[optionNum]
      
      if (serviceType) {
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
    
    return `Hola${customerName ? `, *${customerName}*` : ''} 👋

¿qué tipo de servicio necesitás?`
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