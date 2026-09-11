import { eventBus } from '@/infrastructure/events/event-bus';
import { DOMAIN_EVENTS, LeadCreatedPayload, LeadStatusChangedPayload } from '@/infrastructure/events/event.types';

/**
 * Actor used by the WhatsApp bot when it publishes audit events.
 *
 * Must be a VALID 24-hex ObjectId because ActivityLogService.create() casts
 * actorId with `new Types.ObjectId(...)`. Using the same value as the UI's
 * SYSTEM_ACTOR_ID ('000...000') keeps the bot badge working in the audit table.
 */
export const BOT_ACTOR_ID = '000000000000000000000000';

/**
 * Publishes enriched audit events when a WhatsApp bot flow completes.
 *
 * The bot creates leads at the START of the conversation with minimal data (name/phone).
 * As the flow progresses, the bot collects score, temperature, address, notes, etc.
 * When the flow completes and the lead transitions new -> contacted, this function
 * publishes LEAD_CREATED with the full captured data plus LEAD_STATUS_CHANGED.
 *
 * This replaces the minimal creation-time logActivity that only stored name/phone.
 * Best-effort: never throws, never breaks the bot flow.
 */
export async function publishCompletedBotLeadAudit(
  data: LeadCreatedPayload,
  tenantId: string,
): Promise<void> {
  const { leadId, ...rest } = data;

  // 1. LEAD_CREATED with enriched payload
  try {
    console.log('[LEAD-AUDIT] Publishing LEAD_CREATED', {
      leadId,
      status: rest.status,
      fields: Object.keys(rest),
    });
    await eventBus.publish({
      type: DOMAIN_EVENTS.LEAD_CREATED,
      aggregateId: leadId,
      aggregateType: 'Lead',
      tenantId,
      userId: BOT_ACTOR_ID,
      timestamp: new Date(),
      payload: {
        leadId,
        ...rest,
      } as LeadCreatedPayload,
    });
    console.log('[LEAD-AUDIT] LEAD_CREATED published OK', { leadId });
  } catch (error) {
    console.error('[LeadAuditPublisher] Failed to publish LEAD_CREATED:', error);
  }

  // 2. LEAD_STATUS_CHANGED: new -> contacted (bot flow completed)
  try {
    console.log('[LEAD-AUDIT] Publishing LEAD_STATUS_CHANGED', {
      leadId,
      from: 'new',
      to: 'contacted',
    });
    await eventBus.publish({
      type: DOMAIN_EVENTS.LEAD_STATUS_CHANGED,
      aggregateId: leadId,
      aggregateType: 'Lead',
      tenantId,
      userId: BOT_ACTOR_ID,
      timestamp: new Date(),
      payload: {
        leadId,
        from: 'new',
        to: 'contacted',
        leadName: rest.name,
      } as LeadStatusChangedPayload,
    });
    console.log('[LEAD-AUDIT] LEAD_STATUS_CHANGED published OK', { leadId });
  } catch (error) {
    console.error('[LeadAuditPublisher] Failed to publish LEAD_STATUS_CHANGED:', error);
  }
}
