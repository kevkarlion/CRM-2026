/**
 * Conversation State Interface Contract
 * 
 * Defines the contract that all conversation states must implement.
 * Each state is responsible for processing user input and generating replies.
 */

import type { ConversationContext } from '../context'
import type { ProcessResult } from '../types'

/**
 * Interface that all conversation states must implement
 */
export interface IConversationState {
  /** Unique identifier for this state */
  readonly id: string

  /**
   * Process user input and extract intent
   * @param input - The raw user input
   * @param context - Current conversation context
   * @returns ProcessResult with extracted intent
   */
  process(input: string, context: ConversationContext): ProcessResult

  /**
   * Get the message to send to the user for this state
   * @param context - Current conversation context
   * @returns The message text
   */
  getMessage(context: ConversationContext): string

  /**
   * Get quick reply options for this state (optional)
   * @param context - Current conversation context
   * @returns Array of option strings
   */
  getOptions?(context: ConversationContext): string[]
}

/**
 * Result from the state registry
 */
export interface StateRegistryResult {
  state: IConversationState
  config: {
    next?: string | { [key: string]: string }
    terminal?: boolean
    onError?: string
  }
}