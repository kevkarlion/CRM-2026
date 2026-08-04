/**
 * Waiting Operator State
 * 
 * Terminal state for customer flow.
 * Sets context.complete = true and status to waiting for operator.
 * Does NOT send auto-response - waits for human agent to respond.
 */

import type { ConversationContext } from '../../context'
import type { ProcessResult, StateIntent } from '../../types'
import type { IConversationState } from '../interface'

export class WaitingOperatorState implements IConversationState {
  readonly id = 'waiting_operator'

  process(input: string, context: ConversationContext): ProcessResult {
    // This is a terminal state - any input triggers handoff
    const intent: StateIntent = {
      terminal: true,
      handoff: true,
      handoffReason: 'customer_service_complete',
      data: {
        complete: true,
        status: 'waiting_for_operator',
      },
    }

    return {
      intent,
      isValid: true,
    }
  }

  getMessage(context: ConversationContext): string {
    // This state doesn't send a message - it triggers handoff
    // The message will be provided by the handoff handler
    return ''
  }

  getOptions(context: ConversationContext): string[] | undefined {
    return undefined
  }
}

export default WaitingOperatorState