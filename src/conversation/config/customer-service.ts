/**
 * Customer Service Flow Configuration
 * 
 * Flow for existing clients - provides personalized greeting,
 * confirms service type, verifies address, collects priority (when needed),
 * issue description, provides summary, and optionally hands off to an operator.
 */

import type { FlowConfig } from '../types'

/**
 * Customer Service Flow
 * For existing clients: personalized greeting, service type, address confirm,
 * priority (optional), description, summary, waiting for operator
 */
export const CUSTOMER_SERVICE_FLOW: FlowConfig = {
  id: 'customer-service',
  // Customer starts with personalized greeting using their name
  initialState: 'greeting_personalized',
  metadata: {
    name: 'Customer Service Flow',
    description: 'Flujo de atención al cliente - clientes existentes',
  },
  states: {
    greeting_personalized: {
      next: 'address_confirm',
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
      onError: 'description',
    },
    summary: {
      terminal: true, // Summary is terminal - no waiting_operator state
    },
    waiting_operator: {
      // DEPRECATED: kept for legacy conversations. Use terminal on summary instead.
      terminal: true,
    },
  },
}

export default CUSTOMER_SERVICE_FLOW