import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import chatService from '@/crm/services/chat.service';

/**
 * GET /api/crm/whatsapp/conversations
 * Lists conversations grouped by phone number with last message and unread count.
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const conversations = await chatService.listConversations(tenantId, { limit, offset });

    return NextResponse.json({ conversations });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}
