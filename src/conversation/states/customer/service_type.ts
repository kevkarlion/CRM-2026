/**
 * Service Type State (Customer)
 * 
 * Collects the type of service requested from numbered options.
 * Options tailored for existing customers.
 * Uses unified mapping utility to ensure consistent scoring with lead flow.
 */

import type { ConversationContext } from '../../context'
import type { ProcessResult, StateIntent } from '../../types'
import type { IConversationState } from '../interface'
import { mapServiceOption, getServiceOptions, SERVICE_TYPE_LABELS } from '../../utils/service-type-mapping'

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

    const mapped = mapServiceOption(optionNum)

    if (!mapped) {
      const intent: StateIntent = {
        validationError: '⚠️ Opción inválida. Por favor, elegí un número del 1 al 6.',
      }

      return {
        intent,
        isValid: false,
      }
    }

    // Include needType for scoring - ensures customer flow uses same
    // scoring logic as lead flow
    const intent: StateIntent = {
      data: {
        serviceType: mapped.serviceType,
        serviceTypeLabel: mapped.serviceTypeLabel,
        needType: mapped.needType, // Critical for scoring to work
      },
      nextState: 'address_confirm',
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    return `¿Qué tipo de servicio necesitás?`
  }

  getOptions(context: ConversationContext): string[] | undefined {
    return getServiceOptions()
  }
}

/**
 * Get the label for a service type
 */
export function getServiceTypeLabel(serviceType: string): string {
  return SERVICE_TYPE_LABELS[serviceType] || serviceType
}

export default ServiceTypeState