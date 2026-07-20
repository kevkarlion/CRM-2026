import { DomainEvent } from './event.types';

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void>;

/**
 * EventBus - Domain Event Dispatcher
 * 
 * Distributes Domain Events to registered handlers.
 * No business logic. No entity modifications.
 * Only distributes events to side-effect handlers.
 * 
 * Handlers are lazily initialized on first publish() if not already registered.
 * This solves Next.js App Router module isolation where layout.tsx and API routes
 * may not share the same module-level side effects.
 */
export class EventBus {
  private handlers = new Map<string, EventHandler[]>();
  private initialized = false;

  /**
   * Lazily initialize handlers on first publish.
   * This ensures handlers are always registered regardless of which
   * module first touches the eventBus singleton.
   */
  private ensureInitialized(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Dynamic import to avoid circular dependencies
    // and ensure handlers are registered in the correct module context
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { setupEventHandlers } = require('./setup');
      setupEventHandlers();
    } catch (error) {
      console.error('[EventBus] Failed to initialize handlers:', error);
    }
  }

  /**
   * Register a handler for a specific event type.
   * Use '*' to listen to all events (useful for Audit).
   */
  on(eventType: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) || [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }

  /**
   * Remove all handlers for a specific event type.
   * Useful for testing.
   */
  off(eventType: string): void {
    this.handlers.delete(eventType);
  }

  /**
   * Remove all registered handlers.
   * Useful for testing.
   */
  clear(): void {
    this.handlers.clear();
    this.initialized = false;
  }

  /**
   * Publish a Domain Event to all registered handlers.
   * Handlers are executed sequentially to maintain order.
   * If a handler fails, it's logged but doesn't block other handlers.
   */
  async publish(event: DomainEvent): Promise<void> {
    this.ensureInitialized();

    const eventHandlers = this.handlers.get(event.type) || [];
    const wildcardHandlers = this.handlers.get('*') || [];
    const allHandlers = [...eventHandlers, ...wildcardHandlers];

    console.log(`[EventBus] Publishing ${event.type} - handlers found: ${allHandlers.length} (specific: ${eventHandlers.length}, wildcard: ${wildcardHandlers.length})`);

    for (const handler of allHandlers) {
      try {
        await handler(event);
        console.log(`[EventBus] Handler executed successfully for ${event.type}`);
      } catch (error) {
        console.error(
          `[EventBus] Handler error for ${event.type}:`,
          error instanceof Error ? error.message : error
        );
        // Don't throw - other handlers should still execute
      }
    }
  }
}

// Singleton instance
export const eventBus = new EventBus();
