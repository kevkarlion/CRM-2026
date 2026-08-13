/**
 * Evaluate State (Customer)
 * 
 * This state serves as a checkpoint for calculating lead scoring.
 * It doesn't collect user input - it simply passes through to the next state.
 * The scoring calculation is handled by handle-incoming-message.ts when
 * reaching this state.
 */

import type { ConversationContext } from '../../context'
import type { ProcessResult, StateIntent } from '../../types'
import type { IConversationState } from '../interface'

export class EvaluateState implements IConversationState {
  readonly id = 'evaluate'

  process(input: string, context: ConversationContext): ProcessResult {
    // Always pass through - scoring is handled by handle-incoming-message.ts
    const intent: StateIntent = {
      data: {},
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    // This state shouldn't display a message - it passes through
    return ''
  }

  getOptions(context: ConversationContext): string[] | undefined {
    return undefined
  }
}

export default EvaluateState