import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import { ConversationQueryService } from '@/conversation/infrastructure/conversation-query.service';

const queryService = new ConversationQueryService();

/**
 * GET /api/crm/conversations/handoffs
 *
 * Returns conversations pending handoff with lead data and reason.
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const conversations = await queryService.getPendingHandoffs(tenantId);

    return NextResponse.json({ conversations });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}
