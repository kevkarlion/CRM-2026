import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import { Types } from 'mongoose';

/**
 * Debug: trace customers API logic for Kevin
 * GET /api/debug/trace-kevin
 */
export async function GET() {
  try {
    await connectDB();
    const tenantIdObj = new Types.ObjectId('6a45a83e202f4857cebf0e72');
    const phone = '5492984252859';
    
    // 1. Find conversations
    const conversations = await ConversationModel.find({
      phoneNumber: phone,
      conversationType: 'customer',
    }).lean();
    
    // 2. Find messages
    const messages = await WhatsAppMessageModel.find({
      phone: phone,
    }).sort({ createdAt: -1 }).limit(3).lean();
    
    // 3. Get active conversations with this phone
    const activeConvs = await ConversationModel.find({
      phoneNumber: phone,
      lifecycleState: { $in: ['ACTIVE_CLIENT', 'WAITING_CLIENT', 'IN_PROGRESS'] },
    }).lean();
    
    return NextResponse.json({
      phone,
      conversations: conversations.map(c => ({
        _id: c._id,
        lifecycleState: c.lifecycleState,
        lastMessageAt: c.lastMessageAt,
      })),
      activeCount: activeConvs.length,
      activeConvs: activeConvs.map(c => ({
        _id: c._id,
        lifecycleState: c.lifecycleState,
      })),
      lastMessage: messages[0]?.content?.substring(0, 30),
      lastMessageAt: messages[0]?.createdAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
