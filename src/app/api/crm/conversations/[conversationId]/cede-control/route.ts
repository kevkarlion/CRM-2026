import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';

/**
 * POST /api/crm/conversations/[conversationId]/cede-control
 * Simple switch: OPERATOR -> BOT
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  console.log('[cede-control] Called');
  
  try {
    const tenantId = request.headers.get('x-tenant-id');
    console.log('[cede-control] tenantId:', tenantId);
    
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id required' }, { status: 401 });
    }

    const { conversationId } = await params;
    console.log('[cede-control] conversationId:', conversationId);

    await connectDB();
    console.log('[cede-control] DB connected');

    const result = await ConversationModel.findByIdAndUpdate(
      conversationId,
      {
        $set: {
          owner: 'BOT',
          lifecycleState: 'ACTIVE_LEAD',
          lastActivityAt: new Date(),
        },
      },
      { new: true }
    );

    console.log('[cede-control] Updated:', !!result);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[cede-control] Error:', error);
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}