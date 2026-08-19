import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import { WhatsAppBotAdapter } from '@/conversation/infrastructure/whatsapp-adapter';

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

    // Get conversation to know the phone number
    const conversation = await ConversationModel.findById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

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

    // Notify user that bot is resuming
    try {
      const adapter = new WhatsAppBotAdapter();
      await adapter.sendMessage(
        '🤖 He retomado la conversación. ¿En qué puedo ayudarte?',
        conversation.phoneNumber,
        tenantId
      );
    } catch (notifyError) {
      console.error('[CedeControl] Failed to notify user:', notifyError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[cede-control] Error:', error);
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}