import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import { conversationResolver } from '@/conversation/application/conversation-resolver';
import { WhatsAppBotAdapter } from '@/conversation/infrastructure/whatsapp-adapter';

/**
 * POST /api/crm/conversations/[conversationId]/take-control
 * 
 * Operator takes control of the conversation.
 * Bot will no longer respond - all messages go to operator.
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

    // Take control using the resolver
    await conversationResolver.takeControl(conversationId, userId);

    // Notify user that an operator will attend them
    try {
      const adapter = new WhatsAppBotAdapter();
      await adapter.sendMessage(
        '👤 Un operador va a atenderte. Pronto te responderemos.',
        conversation.phoneNumber,
        tenantId
      );
    } catch (notifyError) {
      console.error('[TakeControl] Failed to notify user:', notifyError);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Conversation taken control successfully' 
    });
  } catch (error) {
    console.error('[TakeControl] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}