import { eventBus } from './event-bus';
import { timelineHandler } from '@/timeline/handlers/timeline.handler';
import { clientActivityOrchestrator } from '@/timeline/handlers/client-activity.handler';
import { auditHandler } from '@/audit/handlers/audit.handler';
import { gestionSyncHandler } from '@/gestion/handlers/gestion-sync.handler';

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

  // Client activity orchestrator (Phase 2) - single writer of entityType 'client' entries
  clientActivityOrchestrator.register();

  // Audit handlers (Phase 6)
  auditHandler.register();

  // Gestion sync handlers - keep Gestion status in sync with Lead pipeline
  gestionSyncHandler.register();

  // Dashboard handlers (future)
  // Notification handlers (future)
  // Analytics handlers (future)

  console.log('[EventBus] Event handlers registered.');
}
