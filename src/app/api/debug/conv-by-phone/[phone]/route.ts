import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';

/**
 * Get conversation by phone
 * GET /api/debug/conv-by-phone/[phone]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    await connectDB();
    const { phone } = await params;
    
    // Find conversations for this phone
    const conversations = await ConversationModel.find({
      phoneNumber: phone,
    }).sort({ createdAt: -1 }).limit(5).lean();

    return NextResponse.json({ 
      count: conversations.length,
      conversations: conversations.map(c => ({
        _id: c._id,
        lifecycleState: c.lifecycleState,
        lastMessageAt: c.lastMessageAt,
        lastReadAt: (c as any).lastReadAt,
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}
