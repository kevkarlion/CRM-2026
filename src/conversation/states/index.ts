/**
 * State Registry
 * 
 * Central registry for all conversation states.
 * Provides lookup by state ID for the conversation engine.
 * 
 * IMPORTANT: States are completely separated by flow:
 * - lead-qualification flow uses states from lead/ folder
 * - customer-service flow uses states from customer/ folder
 * 
 * NO cross-contamination between flows.
 */

import type { IConversationState, StateRegistryResult } from './interface'
import type { FlowConfig } from '../types'

// Import lead states
import { GreetingState as LeadGreetingState } from './lead/greeting'
import { NameState as LeadNameState } from './lead/name'
import { ServiceState as LeadServiceState } from './lead/service'
import { AddressState as LeadAddressState } from './lead/address'
import { PriorityState as LeadPriorityState } from './lead/priority'
import { DescriptionState as LeadDescriptionState } from './lead/description'
import { EvaluateState as LeadEvaluateState } from './lead/evaluate'
import { ConfirmationState as LeadConfirmationState } from './lead/confirmation'

// Import customer states
import { getCustomerState } from './customer'

// Lead flow states - completely isolated
const LEAD_STATES: Record<string, IConversationState> = {
  greeting: new LeadGreetingState(),
  name: new LeadNameState(),
  service: new LeadServiceState(),
  address: new LeadAddressState(),
  priority: new LeadPriorityState(),
  description: new LeadDescriptionState(),
  evaluate: new LeadEvaluateState(),
  confirmation: new LeadConfirmationState(),
  // Nuevos estados del flow de 7 ramas
  greeting_personalized: getCustomerState('greeting_personalized')!,
  urgency: getCustomerState('urgency')!,
  detail: getCustomerState('detail')!,
  quote_work: getCustomerState('quote_work')!,
  spare_part: getCustomerState('spare_part')!,
  general_query: getCustomerState('general_query')!,
  suppliers_info: getCustomerState('suppliers_info')!,
  summary: getCustomerState('summary')!,
  waiting_operator: getCustomerState('waiting_operator')!,
}

/**
 * Get a state by ID for a specific flow
 * 
 * @param stateId - The state ID to look up
 * @param flowId - The flow ID to determine which states to use
 */
export function getState(stateId: string, flowId?: string): IConversationState | undefined {
  if (flowId === 'lead-qualification') {
    return LEAD_STATES[stateId]
  }
  
  if (flowId === 'customer-service') {
    return getCustomerState(stateId)
  }
  
  // Legacy fallback - shouldn't happen
  return LEAD_STATES[stateId]
}

/**
 * Check if a state exists in the registry
 */
export function hasState(stateId: string): boolean {
  return stateId in LEAD_STATES || getCustomerState(stateId) !== undefined
}

/**
 * Get all available state IDs
 */
export function getAllStateIds(): string[] {
  const customerStateIds = [
    'greeting_personalized',
    'service_type',
    'address_confirm',
    'priority',
    'description',
    'evaluate',
    'summary',
    'waiting_operator',
  ]
  return [...Object.keys(LEAD_STATES), ...customerStateIds]
}

/**
 * Get a state with its configuration from flow
 */
export function getStateWithConfig(stateId: string, flowConfig: FlowConfig): StateRegistryResult | undefined {
  const state = getState(stateId, flowConfig.id)

  if (!state) {
    return undefined
  }

  return {
    state,
    config: flowConfig.states[stateId] ?? {},
  }
}

/**
 * State registry class for use with ConversationEngine
 */
export class StateRegistry {
  get(stateId: string, flowId?: string): IConversationState | undefined {
    return getState(stateId, flowId)
  }

  has(stateId: string): boolean {
    return hasState(stateId)
  }

  getAllIds(): string[] {
    return getAllStateIds()
  }
}

// Export state classes for direct use
export { GreetingState } from './lead/greeting'
export { NameState } from './lead/name'
export { ServiceState, getServiceTypeLabel } from './lead/service'
export { AddressState } from './lead/address'
export { PriorityState } from './lead/priority'
export { DescriptionState } from './lead/description'
export { ConfirmationState } from './lead/confirmation'
