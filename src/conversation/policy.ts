/**
 * Transition Policy - Determines next state based on current state and intent
 * 
 * Decouples states from knowing their successors by using a policy pattern.
 * Allows flow configuration to change without modifying state classes.
 */

import type { ConversationContext } from './context'
import type { StateIntent, FlowConfig, ProcessResult } from './types'

/**
 * Policy configuration options
 */
export interface TransitionPolicyOptions {
  /** Default fallback state when no transition is found */
  fallbackState?: string
  /** Error state identifier */
  errorState?: string
}

/**
 * Determines the next state in a conversation flow based on current state and intent
 */
export class TransitionPolicy {
  private fallbackState: string
  private errorState: string

  constructor(options: TransitionPolicyOptions = {}) {
    this.fallbackState = options.fallbackState ?? 'fallback'
    this.errorState = options.errorState ?? 'error'
  }

  /**
   * Get the next state based on current state and processed intent
   * @param currentState - The current state ID
   * @param processResult - The result from processing user input
   * @param context - Current conversation context
   * @param flowConfig - The flow configuration
   * @returns The next state ID, or null if conversation is complete
   */
  getNextState(
    currentState: string,
    processResult: ProcessResult,
    context: ConversationContext,
    flowConfig: FlowConfig,
  ): string | null {
    // Handle validation errors - stay in current state or go to error state
    if (!processResult.isValid) {
      const stateConfig = flowConfig.states[currentState]
      return stateConfig?.onError ?? currentState
    }

    const intent = processResult.intent

    // Handle explicit terminal intent
    if (intent.terminal) {
      return null
    }

    // Handle explicit next state from intent
    if (intent.nextState) {
      return intent.nextState
    }

    // Look up next state from flow configuration
    const stateConfig = flowConfig.states[currentState]
    if (!stateConfig) {
      return this.fallbackState
    }

    // Handle terminal states
    if (stateConfig.terminal) {
      return null
    }

    // Handle conditional next states
    if (typeof stateConfig.next === 'object') {
      return this.resolveConditionalNext(stateConfig.next, intent, context)
    }

    // Return static next state
    return stateConfig.next ?? null
  }

  /**
   * Resolve conditional next state based on intent data
   */
  private resolveConditionalNext(
    conditional: { [key: string]: string },
    intent: StateIntent,
    context: ConversationContext,
  ): string {
    // Try to match by data key
    for (const [key, nextState] of Object.entries(conditional)) {
      if (intent.data?.[key] !== undefined) {
        return nextState
      }
      if (context.get(key) !== undefined) {
        return nextState
      }
    }

    // Default to first option if no match
    return Object.values(conditional)[0] ?? this.fallbackState
  }

  /**
   * Get the fallback state ID
   */
  getFallbackState(): string {
    return this.fallbackState
  }

  /**
   * Get the error state ID
   */
  getErrorState(): string {
    return this.errorState
  }
}