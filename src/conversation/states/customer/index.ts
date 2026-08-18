/**
 * Customer Flow States
 * 
 * Exports all customer-specific conversation states.
 * These states are used in the Customer Service Flow (CUSTOMER_SERVICE_FLOW).
 */

import type { IConversationState } from '../interface'

// Import all customer state implementations
import { GreetingPersonalizedState } from './greeting_personalized'
import { ServiceTypeState, getServiceTypeLabel } from './service_type'
import { AddressConfirmState } from './address_confirm'
import { DescriptionState } from './description'
import { DetailState } from './detail'
import { PriorityState } from './priority'
import { UrgencyState } from './urgency'
import { NameState } from './name'
import { QuoteWorkState } from './quote_work'
import { SparePartState } from './spare_part'
import { GeneralQueryState } from './general_query'
import { SuppliersInfoState } from './suppliers_info'
import { EvaluateState } from './evaluate'
import { SummaryState } from './summary'
import { WaitingOperatorState } from './waiting_operator'

// Map of customer state IDs to state instances
const CUSTOMER_STATES: Record<string, IConversationState> = {
  greeting_personalized: new GreetingPersonalizedState(),
  service_type: new ServiceTypeState(),
  address_confirm: new AddressConfirmState(),
  description: new DescriptionState(),
  detail: new DetailState(),
  priority: new PriorityState(),
  urgency: new UrgencyState(),
  name: new NameState(),
  quote_work: new QuoteWorkState(),
  spare_part: new SparePartState(),
  general_query: new GeneralQueryState(),
  suppliers_info: new SuppliersInfoState(),
  evaluate: new EvaluateState(),
  summary: new SummaryState(),
  waiting_operator: new WaitingOperatorState(),
}

/**
 * Get a customer state by ID
 */
export function getCustomerState(stateId: string): IConversationState | undefined {
  return CUSTOMER_STATES[stateId]
}

/**
 * Check if a customer state exists
 */
export function hasCustomerState(stateId: string): boolean {
  return stateId in CUSTOMER_STATES
}

/**
 * Get all available customer state IDs
 */
export function getAllCustomerStateIds(): string[] {
  return Object.keys(CUSTOMER_STATES)
}

// Export state classes
export { GreetingPersonalizedState } from './greeting_personalized'
export { ServiceTypeState, getServiceTypeLabel } from './service_type'
export { AddressConfirmState } from './address_confirm'
export { DescriptionState } from './description'
export { DetailState } from './detail'
export { PriorityState } from './priority'
export { UrgencyState } from './urgency'
export { NameState } from './name'
export { QuoteWorkState } from './quote_work'
export { SparePartState } from './spare_part'
export { GeneralQueryState } from './general_query'
export { SuppliersInfoState } from './suppliers_info'
export { SummaryState } from './summary'
export { WaitingOperatorState } from './waiting_operator'