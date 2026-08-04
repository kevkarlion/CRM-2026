/**
 * Service Type State (Customer)
 * 
 * Collects the type of service requested from numbered options.
 * Options tailored for existing customers.
 */

import type { ConversationContext } from '../../context'
import type { ProcessResult, StateIntent } from '../../types'
import type { IConversationState } from '../interface'

// Service type options mapping for customers
const SERVICE_OPTIONS: Record<string, string> = {
  '1': 'repair',
  '2': 'maintenance',
  '3': 'installation',
  '4': 'quote',
  '5': 'previous_work',
  '6': 'other',
}

const SERVICE_LABELS: Record<string, string> = {
  'repair': 'Reparación',
  'maintenance': 'Mantenimiento',
  'installation': 'Instalación',
  'quote': 'Presupuesto',
  'previous_work': 'Consulta trabajo anterior',
  'other': 'Otro',
}

export class ServiceTypeState implements IConversationState {
  readonly id = 'service_type'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.trim()

    // Validate input is a number between 1-6
    const optionNum = trimmed.replace(/[^0-9]/g, '')

    if (!optionNum || optionNum < '1' || optionNum > '6') {
      const intent: StateIntent = {
        validationError: '⚠️ Por favor, elegí una opción del 1 al 6.',
      }

      return {
        intent,
        isValid: false,
      }
    }

    const serviceType = SERVICE_OPTIONS[optionNum]

    if (!serviceType) {
      const intent: StateIntent = {
        validationError: '⚠️ Opción inválida. Por favor, elegí un número del 1 al 6.',
      }

      return {
        intent,
        isValid: false,
      }
    }

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

  getMessage(context: ConversationContext): string {
    return `🛠️ ¿Qué tipo de servicio necesitás?`
  }

  getOptions(context: ConversationContext): string[] | undefined {
    return [
      '1️⃣ Reparación',
      '2️⃣ Mantenimiento',
      '3️⃣ Instalación',
      '4️⃣ Presupuesto',
      '5️⃣ Consulta trabajo anterior',
      '6️⃣ Otro',
    ]
  }
}

/**
 * Get the label for a service type
 */
export function getServiceTypeLabel(serviceType: string): string {
  return SERVICE_LABELS[serviceType] || serviceType
}

export default ServiceTypeState