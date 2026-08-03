/**
 * Service State
 * 
 * Collects the type of service requested from numbered options.
 * Validates selection is between 1-5.
 */

import type { ConversationContext } from '../context'
import type { ProcessResult, StateIntent } from '../types'
import type { IConversationState } from './interface'

// Service type options mapping
const SERVICE_OPTIONS: Record<string, string> = {
  '1': 'installation',
  '2': 'repair',
  '3': 'maintenance',
  '4': 'quote',
  '5': 'other',
}

const SERVICE_LABELS: Record<string, string> = {
  'installation': 'Instalación',
  'repair': 'Reparación',
  'maintenance': 'Mantenimiento',
  'quote': 'Presupuesto',
  'other': 'Otro',
}

export class ServiceState implements IConversationState {
  readonly id = 'service'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.trim()

    // Validate input is a number between 1-5
    const optionNum = trimmed.replace(/[^0-9]/g, '')

    if (!optionNum || optionNum < '1' || optionNum > '5') {
      const intent: StateIntent = {
        validationError: 'Por favor, seleccioná una opción del 1 al 5.',
      }

      return {
        intent,
        isValid: false,
      }
    }

    const serviceType = SERVICE_OPTIONS[optionNum]

    if (!serviceType) {
      const intent: StateIntent = {
        validationError: 'Opción inválida. Por favor, elegí un número del 1 al 5.',
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
      nextState: 'address',
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    return 'Perfecto. ¿Qué tipo de servicio necesitás?'
  }

  getOptions(context: ConversationContext): string[] {
    return [
      '1 - Instalación',
      '2 - Reparación', 
      '3 - Mantenimiento',
      '4 - Presupuesto',
      '5 - Otro'
    ]
  }
}

/**
 * Get the label for a service type
 */
export function getServiceTypeLabel(serviceType: string): string {
  return SERVICE_LABELS[serviceType] || serviceType
}

export default ServiceState