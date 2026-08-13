import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import { Types } from 'mongoose';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    await connectDB();
    const { conversationId } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversation = await ConversationModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(conversationId),
        tenantId: new Types.ObjectId(tenantId),
      },
      {
        $set: { lastReadAt: new Date() },
      },
      { new: true }
    );

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      lastReadAt: conversation.lastReadAt 
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}