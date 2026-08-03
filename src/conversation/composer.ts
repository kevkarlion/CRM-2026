/**
 * Reply Composer - Engine-compatible composer for conversation responses
 * 
 * Adapts the ConversationEngine's ReplyComposer interface to work with
 * the existing state infrastructure. Converts StateIntent to WhatsApp messages.
 * 
 * This is the bridge layer between the new conversation engine and
 * the existing reply composition logic.
 */

import type { ConversationContext } from './context'
import type { IConversationState } from './states/interface'
import type { ReplyComposer } from './engine'
import { BotReplyComposer, BotReply } from './domain/reply-composer'

/**
 * Engine-compatible Reply Composer
 * 
 * Implements the ConversationEngine's ReplyComposer interface by wrapping
 * the existing BotReplyComposer. This allows the new engine to use the
 * tested reply templates while conforming to the engine's interface.
 */
export class EngineReplyComposer implements ReplyComposer {
  private readonly botComposer: BotReplyComposer

  constructor() {
    this.botComposer = new BotReplyComposer()
  }

  /**
   * Compose a reply message based on the current state and context
   * @param state - The current conversation state (implements IConversationState)
   * @param context - Current conversation context with user data
   * @returns Object with content string and optional quick reply options
   */
  compose(
    state: IConversationState,
    context: ConversationContext
  ): { content: string; options?: string[] } {
    // Get the state ID from the state implementation
    const stateId = state.id

    // Convert context to the format expected by BotReplyComposer
    const legacyContext = this.toLegacyContext(context)

    // Get the reply from the existing composer
    const reply = this.botComposer.compose(stateId as any, legacyContext)

    return {
      content: reply.content,
      options: reply.options,
    }
  }

  /**
   * Compose a reply for a terminal/confirmation state
   * @param context - Current conversation context
   * @returns Reply content for confirmation state
   */
  composeConfirmation(context: ConversationContext): { content: string; options?: string[] } {
    const reply = this.botComposer.compose('confirmation' as any, this.toLegacyContext(context))
    return {
      content: reply.content,
      options: reply.options,
    }
  }

  /**
   * Compose a reply for handoff to human agent
   * @param reason - The reason for handoff
   * @returns Reply content for handoff
   */
  composeHandoff(reason: string): { content: string; options?: string[] } {
    const reply = this.botComposer.composeForHandoff(reason)
    return {
      content: reply.content,
      options: reply.options,
    }
  }

  /**
   * Compose a timeout fallback reply
   * @returns Timeout reply content
   */
  composeTimeout(): { content: string; options?: string[] } {
    const reply = this.botComposer.composeTimeout()
    return {
      content: reply.content,
      options: reply.options,
    }
  }

  /**
   * Compose a generic fallback reply for unrecognized input
   * @returns Fallback reply content
   */
  composeFallback(): { content: string; options?: string[] } {
    const reply = this.botComposer.composeFallback()
    return {
      content: reply.content,
      options: reply.options,
    }
  }

  /**
   * Convert engine context to legacy context format expected by BotReplyComposer
   */
  private toLegacyContext(context: ConversationContext): any {
    return {
      // Map engine context data to legacy format
      needType: context.get('needType'),
      phoneNumber: context.phoneNumber,
      // Include other relevant context values
      hasEmergencyKeywords: context.get('hasEmergencyKeywords') ?? false,
      hasProjectKeywords: context.get('hasProjectKeywords') ?? false,
      messageContainsData: context.get('messageContainsData') ?? false,
      userAskedForHuman: context.get('userAskedForHuman') ?? false,
    }
  }
}

// Re-export types for convenience
export type { BotReply } from './domain/reply-composer'

export default EngineReplyComposer