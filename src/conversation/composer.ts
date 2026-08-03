/**
 * Reply Composer - Engine-compatible composer for conversation responses
 * 
 * Adapts the ConversationEngine's ReplyComposer interface to work with
 * the new state implementations. Uses state.getMessage() and state.getOptions().
 */

import type { ConversationContext } from './context'
import type { IConversationState } from './states/interface'
import type { ReplyComposer } from './engine'

/**
 * Engine-compatible Reply Composer
 * 
 * Uses the state's getMessage() and getOptions() methods directly
 * to generate responses for WhatsApp.
 */
export class EngineReplyComposer implements ReplyComposer {
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
    // Use the state's own getMessage() and getOptions() methods
    const content = state.getMessage(context)
    const options = state.getOptions(context)

    return {
      content,
      options,
    }
  }

  /**
   * Compose a reply for a terminal/confirmation state
   * @param context - Current conversation context
   * @returns Reply content for confirmation state
   */
  composeConfirmation(context: ConversationContext): { content: string; options?: string[] } {
    // Get confirmation summary
    const customerName = context.get<string>('customerName') || 'Cliente'
    const serviceType = context.get<string>('serviceTypeLabel') || 'servicio'
    const address = context.get<string>('fullAddress') || context.get<string>('address') || ''
    const priority = context.get<string>('priorityLabel') || ''
    const description = context.get<string>('description') || ''

    const summary = `📋 *Resumen de tu solicitud:*\n\n` +
      `👤 *Nombre:* ${customerName}\n` +
      `🔧 *Servicio:* ${serviceType}\n` +
      `📍 *Dirección:* ${address}\n` +
      `⏰ *Cuándo:* ${priority}\n` +
      `📝 *Descripción:* ${description}\n\n` +
      `¿Confirmás que los datos son correctos?`

    return {
      content: summary,
      options: ['1 - Sí, confirmar', '2 - Corregir'],
    }
  }

  /**
   * Compose a reply for handoff to human agent
   * @param reason - The reason for handoff
   * @returns Reply content for handoff
   */
  composeHandoff(reason: string): { content: string; options?: string[] } {
    return {
      content: 'Te voy a conectar con un especialista. Un momento por favor... 👨‍🔧',
    }
  }

  /**
   * Compose a timeout fallback reply
   * @returns Timeout reply content
   */
  composeTimeout(): { content: string; options?: string[] } {
    return {
      content: 'Tu sesión ha expirado. Escribí "Hola" para iniciar una nueva conversación.',
    }
  }

  /**
   * Compose a generic fallback reply for unrecognized input
   * @returns Fallback reply content
   */
  composeFallback(): { content: string; options?: string[] } {
    return {
      content: 'No entendí tu respuesta. Por favor, respondé según las opciones mostradas.',
    }
  }
}

// Re-export types for convenience
export type { BotReply } from './domain/reply-composer'

export default EngineReplyComposer