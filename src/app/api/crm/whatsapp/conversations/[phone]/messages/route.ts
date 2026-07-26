import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import chatService from '@/crm/services/chat.service';

/**
 * GET /api/crm/whatsapp/conversations/[phone]/messages
 * Gets messages for a specific phone conversation.
 */
export async function GET(
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
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const before = searchParams.get('before') ? new Date(searchParams.get('before')!) : undefined;

    const messages = await chatService.getConversationMessages(tenantId, phone, { limit, before });

    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
