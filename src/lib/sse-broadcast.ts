/**
 * SSE Broadcast - Server-Sent Events broadcaster
 * 
 * Manages connected SSE clients and broadcasts events to them.
 * Used for real-time notifications (e.g., work report completed toasts).
 */

// Map of event type -> Set of response objects (SSE connections)
const clients = new Map<string, Set<ReadableStreamDefaultController>>();

/**
 * Register a new SSE client for a specific event type.
 * 
 * @param eventType - The event type to subscribe to (e.g., 'workReportCompleted')
 * @param controller - The stream controller to send events to
 */
export function addSSEClient(eventType: string, controller: ReadableStreamDefaultController): void {
  if (!clients.has(eventType)) {
    clients.set(eventType, new Set());
  }
  clients.get(eventType)!.add(controller);
}

/**
 * Remove an SSE client from all event types.
 * 
 * @param controller - The stream controller to remove
 */
export function removeSSEClient(controller: ReadableStreamDefaultController): void {
  for (const clientSet of clients.values()) {
    clientSet.delete(controller);
  }
}

/**
 * Broadcast an event to all connected SSE clients subscribed to the event type.
 * 
 * @param eventType - The event type (e.g., 'workReportCompleted')
 * @param data - The data to send as JSON
 */
export function broadcastEvent(eventType: string, data: unknown): void {
  const clientSet = clients.get(eventType);
  if (!clientSet || clientSet.size === 0) {
    return;
  }

  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(message);

  for (const controller of clientSet) {
    try {
      controller.enqueue(encoded);
    } catch (error) {
      // Client may have disconnected - remove it
      console.warn(`[SSE Broadcast] Failed to send to client:`, error);
      clientSet.delete(controller);
    }
  }
}

/**
 * Broadcast WORK_ORDER_COMPLETED event to connected SSE clients.
 * This is called when a technician completes a work report.
 * 
 * @param payload - The work order completed payload
 */
export function broadcastWorkReportCompleted(payload: {
  workOrderId: string;
  workReportId: string;
  workOrderNumber: string;
  technicianName: string;
  clientId?: string;
  title?: string;
}): void {
  broadcastEvent('workReportCompleted', payload);
}

/**
 * Broadcast ATTENTION_MARK_ADDED event to connected SSE clients.
 * This is called when a user is marked for follow-up attention.
 * 
 * @param payload - The attention mark payload
 */
export function broadcastAttentionMarkAdded(payload: {
  userEmail: string; // Who should see this (assigned user)
  markId: string;
  targetType: 'lead' | 'client';
  targetId: string;
  targetName: string;
  markedBy: string;
  markedAt: string;
}): void {
  broadcastEvent('attentionMarkAdded', payload);
}
