import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import { ConversationQueryService } from '@/conversation/infrastructure/conversation-query.service';

const queryService = new ConversationQueryService();

/**
 * GET /api/crm/conversations/[conversationId]
 *
 * Returns full conversation detail with messages, lead data, and state history.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    await connectDB();

    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { conversationId } = await params;

    const detail = await queryService.getConversationDetail(conversationId);

    if (!detail) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Ensure the conversation belongs to the authenticated tenant
    if (detail.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ conversation: detail });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}
