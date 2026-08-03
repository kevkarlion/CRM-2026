/**
 * Flow Configuration - Rolo Climatización Default Flow
 * 
 * Defines the conversation flow for collecting lead information.
 * This is the default flow for Rolo Climatización's WhatsApp bot.
 */

import type { FlowConfig } from '../types'

/**
 * Default flow for Rolo Climatización
 * Collects: name, service type, address, priority, description
 * Ends with confirmation
 */
export const ROLO_CLIMATIZACION_FLOW: FlowConfig = {
  id: 'rolo-climatizacion-default',
  initialState: 'greeting',
  metadata: {
    name: 'Rolo Climatización - Solicitud de Servicio',
    description: 'Flujo por defecto para gestionar solicitudes de servicio via WhatsApp',
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
      next: 'confirmation',
      onError: 'description',
    },
    confirmation: {
      terminal: true,
    },
  },
}

/**
 * Get the default flow configuration
 */
export function getDefaultFlow(): FlowConfig {
  return ROLO_CLIMATIZACION_FLOW
}

/**
 * Get a flow by ID (for future extension with multiple flows)
 */
export function getFlow(flowId: string): FlowConfig | undefined {
  const flows: Record<string, FlowConfig> = {
    'rolo-climatizacion-default': ROLO_CLIMATIZACION_FLOW,
  }

  return flows[flowId]
}

export default ROLO_CLIMATIZACION_FLOW