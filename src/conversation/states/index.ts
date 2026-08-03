/**
 * State Registry
 * 
 * Central registry for all conversation states.
 * Provides lookup by state ID for the conversation engine.
 */

import type { IConversationState, StateRegistryResult } from './interface'
import type { FlowConfig } from '../types'

// Import all state implementations
import { GreetingState } from './greeting'
import { NameState } from './name'
import { ServiceState } from './service'
import { AddressState } from './address'
import { PriorityState } from './priority'
import { DescriptionState } from './description'
import { ConfirmationState } from './confirmation'

// Map of state IDs to state instances
const STATES: Record<string, IConversationState> = {
  greeting: new GreetingState(),
  name: new NameState(),
  service: new ServiceState(),
  address: new AddressState(),
  priority: new PriorityState(),
  description: new DescriptionState(),
  confirmation: new ConfirmationState(),
}

/**
 * Get a state by ID
 */
export function getState(stateId: string): IConversationState | undefined {
  return STATES[stateId]
}

/**
 * Check if a state exists
 */
export function hasState(stateId: string): boolean {
  return stateId in STATES
}

/**
 * Get all available state IDs
 */
export function getAllStateIds(): string[] {
  return Object.keys(STATES)
}

/**
 * Get a state with its configuration from flow
 */
export function getStateWithConfig(stateId: string, flowConfig: FlowConfig): StateRegistryResult | undefined {
  const state = STATES[stateId]

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
  get(stateId: string): IConversationState | undefined {
    return getState(stateId)
  }

  has(stateId: string): boolean {
    return hasState(stateId)
  }

  getAllIds(): string[] {
    return getAllStateIds()
  }
}

// Export state classes for direct use
export { GreetingState } from './greeting'
export { NameState } from './name'
export { ServiceState, getServiceTypeLabel } from './service'
export { AddressState } from './address'
export { PriorityState, getPriorityLabel } from './priority'
export { DescriptionState } from './description'
export { ConfirmationState } from './confirmation'