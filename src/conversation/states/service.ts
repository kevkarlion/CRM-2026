/**
 * Service State
 * 
 * Collects the type of service requested from numbered options.
 * Validates selection is between 1-6.
 * Uses unified mapping utility to ensure scoring works with both
 * keyword input and numbered selections.
 */

import type { ConversationContext } from '../context'
import type { ProcessResult, StateIntent } from '../types'
import type { IConversationState } from './interface'
import { mapServiceOption, getServiceOptions, SERVICE_TYPE_LABELS } from '../utils/service-type-mapping'

const SUPPLIER_PHONE = '2994584104';
const FOOTER_MESSAGE = `¿Eres proveedor? Por favor comunícate directamente al ${SUPPLIER_PHONE}.`;

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

    const mapped = mapServiceOption(optionNum);

    if (!mapped) {
      const intent: StateIntent = {
        validationError: '⚠️ Opción inválida. Por favor, elegí un número del 1 al 6.',
      }

      return {
        intent,
        isValid: false,
      }
    }

    // Include needType for scoring - this is the key change that makes
    // scoring work with numbered selections (not just keywords)
    const intent: StateIntent = {
      data: {
        serviceType: mapped.serviceType,
        serviceTypeLabel: mapped.serviceTypeLabel,
        needType: mapped.needType, // Critical for scoring to work
      },
      nextState: 'address',
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    // Message without options - they're added by formatEngineMessage
    return `¿Qué tipo de servicio necesitás?`
  }

  getOptions(context: ConversationContext): string[] {
    return getServiceOptions()
  }

  getFooter(context: ConversationContext): string {
    return FOOTER_MESSAGE
  }
}

/**
 * Get the label for a service type
 */
export function getServiceTypeLabel(serviceType: string): string {
  return SERVICE_TYPE_LABELS[serviceType] || serviceType
}

export default ServiceState