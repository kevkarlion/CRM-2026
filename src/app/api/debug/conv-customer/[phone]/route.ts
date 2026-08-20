import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';

/**
 * Debug: show all conversations for this phone with customer type
 * GET /api/debug/conv-customer/[phone]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    await connectDB();
    const { phone } = await params;
    
    // Find customer conversations for this phone
    const conversations = await ConversationModel.find({
      phoneNumber: phone,
      conversationType: 'customer',
    }).sort({ lastMessageAt: -1 }).limit(5).lean();

    return NextResponse.json({ 
      conversations: conversations.map(c => ({
        _id: c._id,
        lifecycleState: c.lifecycleState,
        lastMessageAt: c.lastMessageAt,
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
