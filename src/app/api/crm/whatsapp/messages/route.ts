import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import whatsappService from '@/crm/services/whatsapp.service';

/**
 * POST /api/crm/whatsapp/messages
 * Sends a WhatsApp message to a phone number.
 * Body: { phone: string, content: string, leadId?: string }
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const body = await req.json();
    const { phone, content, leadId } = body;

    if (!phone || !content) {
      return NextResponse.json(
        { error: 'phone and content are required' },
        { status: 400 }
      );
    }

    const result = await whatsappService.sendMessage(
      tenantId,
      phone,
      content,
      leadId
    );

    return NextResponse.json({
      message: {
        _id: String(result.message._id),
        phone: result.message.phone,
        leadId: result.message.leadId ? String(result.message.leadId) : undefined,
        messageId: result.message.messageId,
        direction: result.message.direction,
        type: result.message.type,
        content: result.message.content,
        status: result.message.status,
        errorMessage: result.message.errorMessage,
        readAt: result.message.readAt?.toISOString(),
        deliveredAt: result.message.deliveredAt?.toISOString(),
        createdAt: result.message.createdAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error('[WhatsApp] Error sending message:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}