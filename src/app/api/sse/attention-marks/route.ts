import { NextRequest, NextResponse } from 'next/server';
import { addSSEClient, removeSSEClient } from '@/lib/sse-broadcast';

/**
 * GET /api/sse/attention-marks
 * 
 * Server-Sent Events endpoint for real-time attention mark notifications.
 * Clients connect via EventSource and receive immediate notifications
 * when they are marked for follow-up attention.
 * 
 * No polling - events are pushed in real-time.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Create a ReadableStream to send SSE events
  const stream = new ReadableStream({
    start(controller) {
      // Register this client for attentionMarkAdded events
      addSSEClient('attentionMarkAdded', controller);

      // Send initial connection event
      const encoder = new TextEncoder();
      const connectMessage = `event: connected\ndata: {"status":"connected","timestamp":"${new Date().toISOString()}"}\n\n`;
      controller.enqueue(encoder.encode(connectMessage));

      // Keep-alive: send comment every 25 seconds to prevent timeout
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          // Client disconnected
          clearInterval(keepAliveInterval);
        }
      }, 25000);

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
        removeSSEClient(controller);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
    cancel() {
      // Called when client disconnects
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
