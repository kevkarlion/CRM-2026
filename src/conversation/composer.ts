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
    // Check if this is a terminal state (confirmation was just completed)
    const isComplete = context.get('complete') === true || context.get('confirmed') === true;
    
    if (isComplete && state.id === 'confirmation') {
      return {
        content: `✅ ¡Perfecto!

Ya registramos tu solicitud correctamente.

En los próximos minutos un asesor de *Rolo Climatización S.R.L* continuará la conversación para ayudarte.

¡Muchas gracias por contactarnos! 🤖`,
      };
    }
    
    // Use the state's own getMessage() and getOptions() methods
    const content = state.getMessage(context)
    const options = state.getOptions(context)
    const footer = (state as any).getFooter?.(context) // Optional footer from state

    return {
      content,
      options,
      footer,
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
    const locality = context.get<string>('locality') || ''
    const province = context.get<string>('province') || ''
    const priority = context.get<string>('priorityLabel') || ''
    const description = context.get<string>('description') || ''

    // Build full address
    let fullAddress = address
    if (locality || province) {
      fullAddress = `${address}${locality ? `, ${locality}` : ''}${province ? `, ${province}` : ''}`
    }

    const summary = `✅ *Resumen de tu solicitud*

👤 *Nombre:*
${customerName}

🛠️ *Servicio:*
${serviceType}

📍 *Dirección:*
${fullAddress || 'No especificada'}

📅 *Necesidad:*
${priority}

📝 *Descripción:*
${description}

¿La información es correcta?`

    return {
      content: summary,
      options: ['1️⃣ Sí', '2️⃣ Corregir'],
    }
  }

  /**
   * Compose a reply for handoff to human agent
   * @param reason - The reason for handoff
   * @returns Reply content for handoff
   */
  composeHandoff(reason: string): { content: string; options?: string[] } {
    return {
      content: '👨‍🔧 Te voy a conectar con un especialista. Un momento por favor...',
    }
  }

  /**
   * Compose a timeout fallback reply
   * @returns Timeout reply content
   */
  composeTimeout(): { content: string; options?: string[] } {
    return {
      content: '⏰ Tu sesión ha expirado.\n\nEscribí "Hola" para iniciar una nueva conversación.',
    }
  }

  /**
   * Compose a generic fallback reply for unrecognized input
   * @returns Fallback reply content
   */
  composeFallback(): { content: string; options?: string[] } {
    return {
      content: '⚠️ No pude interpretar tu respuesta.\n\nPor favor, elegí una de las opciones indicadas.',
    }
  }
}

// Re-export types for convenience
export type { BotReply } from './domain/reply-composer'

export default EngineReplyComposer