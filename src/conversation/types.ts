/**
 * Core Types for Conversation Engine
 * 
 * Defines the result types returned by state processing and validation.
 */

/**
 * Intent extracted from user input after processing
 */
export interface StateIntent {
  /** Extracted data from user input */
  data?: Record<string, unknown>
  /** Next state to transition to */
  nextState?: string
  /** Whether conversation is complete */
  terminal?: boolean
  /** Validation error message if input was invalid */
  validationError?: string
  /** Whether to handoff to human agent */
  handoff?: boolean
  /** Reason for handoff if applicable */
  handoffReason?: string
  /** Flow completed - user confirmed all info is correct */
  isComplete?: boolean
}

/**
 * Result returned by a state after processing user input
 */
export interface ProcessResult {
  /** The intent extracted from the input */
  intent: StateIntent
  /** Whether the input was valid */
  isValid: boolean
  /** Error message if processing failed */
  error?: string
}

/**
 * Result of validating user input
 */
export interface ValidationResult {
  /** Whether the input passes validation */
  isValid: boolean
  /** Error message if validation failed */
  error?: string
  /** Normalized/cleaned input value */
  value?: string
}

/**
 * Flow configuration for a conversation
 */
export interface FlowConfig {
  id: string
  initialState: string
  states: {
    [stateId: string]: FlowStateConfig
  }
  metadata?: {
    name: string
    description?: string
  }
}

/**
 * Configuration for a single state in the flow
 */
export interface FlowStateConfig {
  /** Next state(s) - can be static or conditional map */
  next?: string | { [key: string]: string }
  /** Whether this is a terminal state */
  terminal?: boolean
  /** State to transition to on error */
  onError?: string
}

/**
 * Engine result returned after processing
 */
export interface EngineResult {
  /** The reply message to send to user */
  message: string
  /** Quick reply options to display */
  options?: string[]
  /** Updated context after processing */
  context: import('./context').ConversationContext
  /** Whether conversation is complete */
  isComplete: boolean
  /** Whether handoff to human is needed */
  handoff?: boolean
}