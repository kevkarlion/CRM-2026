import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import chatService from '@/crm/services/chat.service';

/**
 * POST /api/crm/whatsapp/conversations/[phone]/read
 * Marks all inbound messages in a conversation as read.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    await connectDB();
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { phone } = await params;
    const result = await chatService.markAsRead(tenantId, phone);

    return NextResponse.json({ modifiedCount: result.modifiedCount });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
