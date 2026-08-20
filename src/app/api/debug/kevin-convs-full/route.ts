import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';

/**
 * Debug: check Kevin's conversations with all fields
 * GET /api/debug/kevin-convs-full
 */
export async function GET() {
  try {
    await connectDB();
    
    const convs = await ConversationModel.find({
      phoneNumber: '5492984252859',
    }).lean();
    
    return NextResponse.json({
      convs: convs.map(c => ({
        _id: c._id,
        tenantId: c.tenantId,
        phoneNumber: c.phoneNumber,
        lifecycleState: c.lifecycleState,
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
