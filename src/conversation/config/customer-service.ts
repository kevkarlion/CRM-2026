/**
 * Customer Service Flow Configuration
 * 
 * Flow for existing clients - provides personalized greeting,
 * confirms service type, verifies address, collects issue description,
 * provides summary, and optionally hands off to an operator.
 */

import type { FlowConfig } from '../types'

/**
 * Customer Service Flow
 * For existing clients: personalized greeting, service type, address confirm,
 * description, summary, waiting for operator
 */
export const CUSTOMER_SERVICE_FLOW: FlowConfig = {
  id: 'customer-service',
  initialState: 'greeting_personalized',
  metadata: {
    name: 'Customer Service Flow',
    description: 'Flujo de atención al cliente - clientes existentes',
  },
  states: {
    greeting_personalized: {
      next: 'service_type',
    },
    service_type: {
      next: 'address_confirm',
      onError: 'service_type',
    },
    address_confirm: {
      next: 'priority',
      onError: 'address_confirm',
    },
    priority: {
      next: 'description',
      onError: 'priority',
    },
    description: {
      next: 'summary',
      onError: 'priority',
    },
    summary: {
      next: 'waiting_operator',
      onError: 'summary',
    },
    waiting_operator: {
      terminal: true,
    },
  },
}

export default CUSTOMER_SERVICE_FLOW