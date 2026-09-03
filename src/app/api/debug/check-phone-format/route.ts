import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import { Types } from 'mongoose';

/**
 * Debug: check phone numbers in conversations
 * GET /api/debug/check-phone-format
 */
export async function GET() {
  try {
    await connectDB();
    const tenantIdObj = new Types.ObjectId('6a45a83e202f4857cebf0e72');
    
    // Get conversations with similar phone numbers
    const convs = await ConversationModel.find({
      tenantId: tenantIdObj,
      conversationType: 'customer',
      lifecycleState: { $in: ['ACTIVE_CLIENT'] },
    }).limit(10).lean();
    
    return NextResponse.json({
      conversations: convs.map(c => ({
        _id: c._id,
        phoneNumber: c.phoneNumber,
        phoneNumberType: typeof c.phoneNumber,
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}
