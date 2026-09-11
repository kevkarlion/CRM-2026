import { eventBus } from '@/infrastructure/events/event-bus';
import { DomainEvent } from '@/infrastructure/events/event.types';
import { activityLogService } from '../services/activity-log.service';

/**
 * AuditHandler - Reacts to ALL Domain Events and creates ActivityLogs.
 *
 * This handler is a SIDE-EFFECT only. It does NOT:
 * - Modify business entities
 * - Make business decisions
 * - Execute business logic
 *
 * It ONLY creates technical audit logs for compliance and debugging.
 */
export const auditHandler = {
  /**
   * Register the audit handler with the EventBus.
   * Uses wildcard '*' to listen to ALL events.
   */
  register(): void {
    eventBus.on('*', auditHandler.onAnyEvent);
  },

  /**
   * Handle any Domain Event by creating an ActivityLog.
   */
  async onAnyEvent(event: DomainEvent): Promise<void> {
    // Skip if we can't attribute the log to an entity. Some events are
    // published without aggregateType/aggregateId (e.g. legacy PUBLISH calls),
    // which would make ActivityLog validation fail (entityType is required).
    if (!event.aggregateType || !event.aggregateId) {
      console.log(
        `[AuditHandler] Skipping activity log for ${event.type}: missing aggregateType/aggregateId`,
      );
      return;
    }

    const action = mapEventToAction(event.type);
    const payload = typeof event.payload === 'object' && event.payload !== null
      ? event.payload as Record<string, unknown>
      : {};

    const metadata: Record<string, unknown> = {
      eventType: event.type,
      ...payload,
    };

    // PII boundary: strip free-text/contact fields from the persisted metadata.
    // Structured traceability (names, profileName, companyName, phone, status,
    // numbers, titles, dates, totals, reasons, technician names) is kept, but
    // email/notes/description are not persisted. Only the audit copy is touched;
    // the event payload itself is left intact for timeline/other handlers.
    delete metadata.email;
    delete metadata.notes;
    delete metadata.description;

    // Creation events must always carry an origin channel so the audit UI can
    // trace where the entity came from; fall back to 'unknown' when missing.
    if (event.type === 'LEAD_CREATED' || event.type === 'CLIENT_CREATED') {
      metadata.source = (payload.source as string) || 'unknown';
    }

    // Deduplication guard (audit unicity only — other handlers still receive
    // both events): changeStatus('completed') publishes WORK_ORDER_STATUS_CHANGED
    // and WORK_ORDER_COMPLETED for the same transition. Only the technician
    // completion flow actually creates a WorkReport and carries workReportId;
    // without it the WORK_ORDER_COMPLETED row would duplicate the
    // 'status_changed' row already written for the same business action.
    if (event.type === 'WORK_ORDER_COMPLETED' && !payload.workReportId) {
      console.log(
        `[AuditHandler] Skipping redundant WORK_ORDER_COMPLETED for ${event.aggregateId} (no workReportId: status_changed row already covers the transition)`,
      );
      return;
    }

    await activityLogService.create({
      tenantId: event.tenantId,
      entityType: event.aggregateType,
      entityId: event.aggregateId,
      action,
      actorId: event.userId,
      metadata,
    });

    // The completion flow also produces the distinct 'work_report_created' action
    // on the WorkReport entity. Write it from the same event so every completion
    // yields exactly one 'work_report_created' row (and one 'work_completed' row).
    if (event.type === 'WORK_ORDER_COMPLETED' && payload.workReportId) {
      await activityLogService.create({
        tenantId: event.tenantId,
        entityType: 'workReport',
        entityId: String(payload.workReportId),
        action: 'work_report_created',
        actorId: event.userId,
        metadata,
      });
    }
  },
};

/**
 * Map Domain Event types to ActivityLog actions.
 */
function mapEventToAction(eventType: string): string {
  const map: Record<string, string> = {
    // Lead
    'LEAD_CREATED': 'created',
    'LEAD_STATUS_CHANGED': 'status_changed',
    'LEAD_CONVERTED': 'converted',

    // Client
    'CLIENT_CREATED': 'created',
    'CLIENT_STATUS_CHANGED': 'status_changed',

    // Gestion
    'GESTION_CREATED': 'created',
    'GESTION_STATUS_CHANGED': 'status_changed',

    // Quote
    'QUOTE_CREATED': 'created',
    'QUOTE_SENT': 'sent',
    'QUOTE_APPROVED': 'approved',
    'QUOTE_REJECTED': 'rejected',
    'QUOTE_CONVERTED': 'status_changed',

    // Negotiation
    'NEGOTIATION_OPENED': 'created',
    'NEGOTIATION_ACCEPTED': 'status_changed',
    'NEGOTIATION_REJECTED': 'status_changed',
    'COUNTER_OFFER_CREATED': 'created',

    // Operations
    'WORK_ORDER_CREATED': 'created',
    'WORK_ORDER_STATUS_CHANGED': 'status_changed',
    'WORK_ORDER_STARTED': 'work_started',
    'WORK_ORDER_COMPLETED': 'work_completed',
    'WORK_ORDER_SELF_ASSIGNED': 'technician.assigned',
    'WORK_ORDER_TECHNICIAN_ASSIGNED': 'technician.assigned',
    'WORK_ORDER_TECHNICIAN_CHANGED': 'technician.reassigned',
    'WORK_ORDER_TECHNICIAN_UNASSIGNED': 'technician.unassigned',
    'VISIT_CREATED': 'created',
    'VISIT_STATUS_CHANGED': 'status_changed',
    'VISIT_COMPLETED': 'status_changed',

    // Sale
    'SALE_CONFIRMED': 'status_changed',

    // Resolution
    'LEAD_RESOLVED': 'resolved',
    'CLIENT_RESOLVED': 'resolved',
    'RESOLVE_CONVERTED_LEAD': 'resolved',
  };

  return map[eventType] || 'updated';
}
