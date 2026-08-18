/**
 * Suppliers Info State
 * 
 * Shows contact information for suppliers/vendors.
 * Branch: Option 7 - Proveedores
 * 
 * This is a terminal state - shows contact info and ends conversation.
 */

import type { ConversationContext } from '../../context'
import type { ProcessResult, StateIntent } from '../../types'
import type { IConversationState } from '../interface'

export class SuppliersInfoState implements IConversationState {
  readonly id = 'suppliers_info'

  process(input: string, context: ConversationContext): ProcessResult {
    // This is a terminal state - just return success and go to summary
    const intent: StateIntent = {
      nextState: 'summary',
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    return `🟣 *PROVEEDORES / ADMINISTRACIÓN*

📞 *Teléfono:* 2994584104

✉️ *Email:* admin@roloclimatizacion.com.ar

podés comunicarte directamente por cualquiera de estos medios.`
  }

  getOptions(context: ConversationContext): string[] | undefined {
    // No options - this is a terminal state
    return undefined
  }
}

export default SuppliersInfoState