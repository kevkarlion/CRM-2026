/**
 * Conversation Engine - Core orchestrator for multi-step conversations
 * 
 * Manages the lifecycle of WhatsApp conversations by coordinating
 * state transitions, context management, and reply composition.
 */

import type { ConversationContext } from './context'
import type { FlowConfig, EngineResult } from './types'
import { ConversationContext as ContextClass } from './context'
import { TransitionPolicy } from './policy'
import type { IConversationState } from './states/interface'

/**
 * Conversation engine options
 */
export interface ConversationEngineOptions {
  /** Flow configuration */
  flowConfig: FlowConfig
  /** State registry */
  stateRegistry: StateRegistry
  /** Transition policy */
  transitionPolicy: TransitionPolicy
  /** Reply composer */
  replyComposer: ReplyComposer
}

/**
 * Simple state registry interface
 */
export interface StateRegistry {
  get(stateId: string): IConversationState | undefined
  has(stateId: string): boolean
}

/**
 * Simple reply composer interface
 */
export interface ReplyComposer {
  compose(state: IConversationState, context: ConversationContext): {
    content: string
    options?: string[]
  }
}

/**
 * Conversation persistence layer interface
 */
export interface ConversationStore {
  get(phoneNumber: string): Promise<ConversationContext | null>
  save(phoneNumber: string, context: ConversationContext): Promise<void>
  delete(phoneNumber: string): Promise<void>
}

/**
 * Core conversation engine orchestrator
 */
export class ConversationEngine {
  private flowConfig: FlowConfig
  private stateRegistry: StateRegistry
  private transitionPolicy: TransitionPolicy
  private replyComposer: ReplyComposer
  private store?: ConversationStore

  constructor(options: ConversationEngineOptions) {
    this.flowConfig = options.flowConfig
    this.stateRegistry = options.stateRegistry
    this.transitionPolicy = options.transitionPolicy
    this.replyComposer = options.replyComposer
  }

  /**
   * Set the persistence store
   */
  setStore(store: ConversationStore): void {
    this.store = store
  }

  /**
   * Set flow configuration dynamically
   * Allows switching between flows (e.g., lead qualification vs customer service)
   */
  setFlowConfig(flowConfig: FlowConfig): void {
    this.flowConfig = flowConfig
    console.log('[Engine] Flow config updated to:', flowConfig.id)
  }

  /**
   * Get current flow configuration
   */
  getFlowConfig(): FlowConfig {
    return this.flowConfig
  }

  /**
   * Start a new conversation from the initial state
   * @param phoneNumber - The phone number
   * @param profileName - Optional profile name from WhatsApp
   * @param initialData - Optional initial data to populate context (e.g., customer info for customer flow)
   */
  async start(phoneNumber: string, profileName?: string, initialData?: Record<string, unknown>): Promise<EngineResult> {
    const context = new ContextClass(phoneNumber)
    if (profileName) {
      context.set('profileName', profileName)
    }
    // Apply initial data if provided (e.g., customer data for customer flow)
    if (initialData) {
      for (const [key, value] of Object.entries(initialData)) {
        context.set(key, value)
      }
    }
    const initialState = this.flowConfig.initialState

    return this.transitionTo(initialState, context)
  }

  /**
   * Process user input in an existing conversation
   */
  async process(phoneNumber: string, input: string, profileName?: string): Promise<EngineResult> {
    // Try to load existing context from store
    let context: ConversationContext

    if (this.store) {
      const stored = await this.store.get(phoneNumber)
      context = stored ?? new ContextClass(phoneNumber)
    } else {
      context = new ContextClass(phoneNumber)
    }
    
    // Update profileName if provided and not already set
    if (profileName && !context.get('profileName')) {
      context.set('profileName', profileName)
    }

    // Get current state from context or use initial
    const currentStateId = context.get<string>('currentState') ?? this.flowConfig.initialState
    console.log('[Engine] Processing input for state:', currentStateId, '| input:', input)
    console.log('[Engine] Full context data:', JSON.stringify(context.data))

    return this.processInput(currentStateId, input, context)
  }

  /**
   * Resume a conversation with an existing context
   */
  async resume(phoneNumber: string, context: ConversationContext): Promise<EngineResult> {
    const currentStateId = context.get<string>('currentState') ?? this.flowConfig.initialState
    const input = context.get<string>('pendingInput') ?? ''

    return this.processInput(currentStateId, input, context)
  }

  /**
   * Get current context for a phone number
   */
  async getState(phoneNumber: string): Promise<ConversationContext | null> {
    if (!this.store) return null
    return this.store.get(phoneNumber)
  }

  /**
   * Process input from current state
   */
  private async processInput(
    currentStateId: string,
    input: string,
    context: ConversationContext,
  ): Promise<EngineResult> {
    const state = this.stateRegistry.get(currentStateId)

    if (!state) {
      return this.createErrorResult(context, `Unknown state: ${currentStateId}`)
    }

    // Process input through the state
    const processResult = state.process(input, context)

    // Determine next state
    const nextStateId = this.transitionPolicy.getNextState(
      currentStateId,
      processResult,
      context,
      this.flowConfig,
    )

    // Handle handoff
    if (processResult.intent.handoff) {
      return this.createHandoffResult(processResult.intent.handoffReason, context)
    }

    // Handle terminal state
    if (nextStateId === null) {
      return this.createTerminalResult(context)
    }

    // Transition to next state
    return this.transitionTo(nextStateId, context, processResult)
  }

  /**
   * Transition to a new state and generate reply
   */
  private async transitionTo(
    stateId: string,
    context: ConversationContext,
    processResult?: { intent: { data?: Record<string, unknown> } },
  ): Promise<EngineResult> {
    // Update context with new state and any extracted data
    context.set('currentState', stateId)

    if (processResult?.intent.data) {
      for (const [key, value] of Object.entries(processResult.intent.data)) {
        context.set(key, value)
      }
    }

    // Persist context if store is configured
    if (this.store) {
      await this.store.save(context.phoneNumber, context)
      console.log('[Engine] Saved context, new state:', stateId)
    }

    // Get state and compose reply
    const state = this.stateRegistry.get(stateId)

    if (!state) {
      return this.createErrorResult(context, `State not found: ${stateId}`)
    }

    const reply = this.replyComposer.compose(state, context)

    return {
      message: reply.content,
      options: reply.options,
      context,
      isComplete: false,
    }
  }

  /**
   * Create error result
   */
  private createErrorResult(context: ConversationContext, error: string): EngineResult {
    return {
      message: `Error: ${error}`,
      context,
      isComplete: false,
    }
  }

  /**
   * Create terminal (complete) result
   */
  private createTerminalResult(context: ConversationContext): EngineResult {
    context.set('complete', true)

    if (this.store) {
      this.store.save(context.phoneNumber, context).catch(console.error)
    }

    return {
      message: '¡Gracias! Tu solicitud ha sido registrada. Te contactaremos pronto.',
      context,
      isComplete: true,
    }
  }

  /**
   * Create handoff result
   */
  private createHandoffResult(reason: string | undefined, context: ConversationContext): EngineResult {
    context.set('handoff', true)
    context.set('handoffReason', reason)

    if (this.store) {
      this.store.save(context.phoneNumber, context).catch(console.error)
    }

    return {
      message: 'Te voy a conectar con un especialista. Un momento por favor...',
      context,
      isComplete: false,
      handoff: true,
    }
  }
}