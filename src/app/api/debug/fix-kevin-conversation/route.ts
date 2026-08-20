import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import { Types } from 'mongoose';

/**
 * Fix: move Kevin's conversation to correct tenant
 * POST /api/debug/fix-kevin-conversation
 */
export async function POST() {
  try {
    await connectDB();
    
    const correctTenantId = new Types.ObjectId('6a45a83e202f4857cebf0e72');
    
    // Find the conversation with wrong tenant
    const conv = await ConversationModel.findOne({
      phoneNumber: '5492984252859',
      tenantId: new Types.ObjectId('000000000000000000000001'),
    });
    
    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    // Update to correct tenant
    conv.tenantId = correctTenantId;
    await conv.save();
    
    return NextResponse.json({ 
      success: true, 
      conversationId: conv._id,
      newTenantId: conv.tenantId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
