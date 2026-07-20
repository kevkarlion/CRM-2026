import { eventBus } from './event-bus';
import { timelineHandler } from '@/timeline/handlers/timeline.handler';
import { auditHandler } from '@/audit/handlers/audit.handler';

/**
 * Setup all event handlers.
 * Import and call this once at application startup.
 *
 * Example in a Next.js app:
 * - Import in src/app/layout.tsx or a root provider
 * - Or import in src/core/bootstrap.ts
 */
export function setupEventHandlers(): void {
  console.log('[EventBus] Setting up event handlers...');

  // Timeline handlers (Phase 1)
  timelineHandler.register();

  // Audit handlers (Phase 6)
  auditHandler.register();

  // Dashboard handlers (future)
  // Notification handlers (future)
  // Analytics handlers (future)

  console.log('[EventBus] Event handlers registered.');
}
