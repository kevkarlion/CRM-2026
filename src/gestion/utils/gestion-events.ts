import { Types } from 'mongoose';
import GestionModel from '../models/gestion';
import { GestionEventType, IGestionEvent } from '../types/gestion';

export type EventData = Record<string, unknown>;

/**
 * Add an event to a Gestion's events array
 */
export async function addEvent(
  gestionId: string,
  tenantId: string,
  eventType: GestionEventType,
  data: EventData,
  userId?: string
): Promise<void> {
  const event: IGestionEvent = {
    type: eventType,
    timestamp: new Date(),
    data,
    userId,
  };

  await GestionModel.updateOne(
    {
      _id: new Types.ObjectId(gestionId),
      tenantId: new Types.ObjectId(tenantId),
    },
    {
      $push: { events: event },
    }
  );

  console.log(`[GestionEvents] Added ${eventType} event to Gestion ${gestionId}`);
}

/**
 * Get all events for a Gestion, sorted by timestamp ascending
 */
export async function getEvents(
  gestionId: string,
  tenantId: string
): Promise<IGestionEvent[]> {
  const gestion = await GestionModel.findOne(
    {
      _id: new Types.ObjectId(gestionId),
      tenantId: new Types.ObjectId(tenantId),
    },
    { events: 1 }
  ).lean();

  if (!gestion) {
    return [];
  }

  // Sort events by timestamp ascending
  const events = gestion.events || [];
  return [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

/**
 * Copy current events to the history entry and clear the events array
 * This is called when a gestion cycle is closed (CLIENT_RESOLVED)
 */
export async function copyEventsToHistory(
  gestionId: string,
  tenantId: string
): Promise<void> {
  const gestion = await GestionModel.findOne({
    _id: new Types.ObjectId(gestionId),
    tenantId: new Types.ObjectId(tenantId),
  }).lean();

  if (!gestion) {
    console.log(`[GestionEvents] Gestion ${gestionId} not found for copying events to history`);
    return;
  }

  const currentEvents = gestion.events || [];

  if (currentEvents.length === 0) {
    console.log(`[GestionEvents] No events to copy for Gestion ${gestionId}`);
    return;
  }

  // Add events to the last history entry
  const historyEntry = {
    closedAt: new Date(),
    finalStatus: gestion.status,
    score: gestion.score || 0,
    temperature: gestion.temperature,
    inquiryReason: gestion.inquiryReason,
    estimatedValue: gestion.estimatedValue,
    notes: gestion.notes,
    adminNotes: gestion.adminNotes,
    events: [...currentEvents],
  };

  await GestionModel.updateOne(
    {
      _id: new Types.ObjectId(gestionId),
      tenantId: new Types.ObjectId(tenantId),
    },
    {
      $push: { history: historyEntry },
      $set: { events: [] },
    }
  );

  console.log(`[GestionEvents] Copied ${currentEvents.length} events to history for Gestion ${gestionId}`);
}
