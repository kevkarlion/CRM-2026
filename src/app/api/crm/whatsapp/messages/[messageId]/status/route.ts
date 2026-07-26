import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import chatService from '@/crm/services/chat.service';
import type { WhatsAppMessageStatus } from '@/crm/types/whatsapp-message';

const VALID_STATUSES: WhatsAppMessageStatus[] = ['pending', 'sent', 'delivered', 'read', 'failed'];

/**
 * PATCH /api/crm/whatsapp/messages/[messageId]/status
 * Updates the delivery status of an outbound message.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    await connectDB();
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { messageId } = await params;
    const body = await req.json();
    const { status, errorMessage } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const message = await chatService.updateMessageStatus(
      tenantId,
      messageId,
      status,
      errorMessage
    );

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json({ message });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
