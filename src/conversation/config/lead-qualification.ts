/**
 * Lead Qualification Flow Configuration
 * 
 * Flow for new contacts/leads - collects name, service type, address,
 * priority, and description. Ends with confirmation.
 */

import type { FlowConfig } from '../types'

/**
 * Lead Qualification Flow
 * Collects: name, service type, address, priority, description
 * Ends with confirmation
 */
export const LEAD_QUALIFICATION_FLOW: FlowConfig = {
  id: 'lead-qualification',
  initialState: 'greeting',
  metadata: {
    name: 'Lead Qualification Flow',
    description: 'Flujo de calificación de leads - nuevos contactos',
  },
  states: {
    greeting: {
      next: 'name',
    },
    name: {
      next: 'service',
      onError: 'name',
    },
    service: {
      next: 'address',
      onError: 'service',
    },
    address: {
      next: 'priority',
      onError: 'address',
    },
    priority: {
      next: 'description',
      onError: 'priority',
    },
    description: {
      next: 'evaluate',
      onError: 'description',
    },
    evaluate: {
      next: 'confirmation',
    },
    confirmation: {
      terminal: true,
    },
  },
}

export default LEAD_QUALIFICATION_FLOW