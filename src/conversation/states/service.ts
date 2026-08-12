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
  '1': 'maintenance',
  '2': 'repair',
  '3': 'spare_parts',
  '4': 'installation',
  '5': 'quote',
  '6': 'other',
}

const SERVICE_LABELS: Record<string, string> = {
  'maintenance': 'Mantenimiento',
  'repair': 'Reparación',
  'spare_parts': 'Repuestos',
  'installation': 'Instalación',
  'quote': 'Presupuesto',
  'other': 'Otro',
}

export class ServiceState implements IConversationState {
  readonly id = 'service'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.trim()

// Validate input is a number between 1-6
    const optionNum = trimmed.replace(/[^0-9]/g, '');

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
      nextState: 'address',
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    return `¿Qué tipo de servicio necesitás?\n\n1️⃣ Mantenimiento\n2️⃣ Reparación\n3️⃣ Repuestos\n4️⃣ Instalación\n5️⃣ Cotización\n6️⃣ Otro\n\n¿Eres proveedor? Por favor comunícate directamente al 2994584104.`
  }

  getOptions(context: ConversationContext): string[] {
    return [
      '1️⃣ Mantenimiento',
      '2️⃣ Reparación',
      '3️⃣ Repuestos',
      '4️⃣ Instalación',
      '5️⃣ Cotización',
      '6️⃣ Otro'
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