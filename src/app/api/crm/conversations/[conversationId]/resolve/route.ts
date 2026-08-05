import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import { conversationResolver } from '@/conversation/application/conversation-resolver';

/**
 * POST /api/crm/conversations/[conversationId]/resolve
 * 
 * Operator marks the conversation as resolved.
 * Starts the 72-hour reuse window.
 */
export async function POST(
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
    
    // Get user ID from header (set by auth middleware)
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Find conversation
    const conversation = await ConversationModel.findById(conversationId);
    
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Check tenant access
    if (conversation.tenantId.toString() !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Mark as resolved using the resolver
    await conversationResolver.markAsResolved(conversationId, userId);

    return NextResponse.json({ 
      success: true, 
      message: 'Conversation marked as resolved successfully' 
    });
  } catch (error) {
    console.error('[Resolve] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}