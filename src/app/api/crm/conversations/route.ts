import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { ConversationQueryService } from '@/conversation/infrastructure/conversation-query.service';

const queryService = new ConversationQueryService();

/**
 * GET /api/crm/conversations
 *
 * Lists active conversations for the authenticated tenant.
 * Query params: status, handoffStatus, limit, offset
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const handoffStatus = searchParams.get('handoffStatus') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const conversations = await queryService.getActiveConversations(tenantId, {
      status,
      handoffStatus,
      limit,
      offset,
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
