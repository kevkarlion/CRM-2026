/**
 * Conversation Context - Data container for conversation state
 * 
 * This is the data layer passed between states during conversation flow.
 * Separated from persistence layer (ConversationContext in domain/conversation.ts).
 */

export interface ConversationContextData {
  phoneNumber: string
  version: number
  data: Record<string, unknown>
}

/**
 * Conversation context that holds conversation state and user data
 */
export class ConversationContext implements ConversationContextData {
  phoneNumber: string
  version: number
  data: Record<string, unknown>

  constructor(phoneNumber: string, version = 1) {
    this.phoneNumber = phoneNumber
    this.version = version
    this.data = {}
  }

  /**
   * Get a value from context by key
   */
  get<T>(key: string): T | undefined {
    return this.data[key] as T | undefined
  }

  /**
   * Set a value in context
   */
  set<T>(key: string, value: T): void {
    this.data[key] = value
  }

  /**
   * Check if a key exists in context
   */
  has(key: string): boolean {
    return key in this.data
  }

  /**
   * Serialize context to JSON for persistence
   */
  toJSON(): ConversationContextData {
    return {
      phoneNumber: this.phoneNumber,
      version: this.version,
      data: { ...this.data },
    }
  }

  /**
   * Reconstruct context from JSON
   */
  static fromJSON(json: ConversationContextData): ConversationContext {
    const ctx = new ConversationContext(json.phoneNumber, json.version)
    ctx.data = { ...json.data }
    return ctx
  }
}