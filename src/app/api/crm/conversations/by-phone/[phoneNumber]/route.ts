import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import { Types } from 'mongoose';
import { normalizePhone, phoneMatchQuery } from '@/lib/phone';

/**
 * GET /api/crm/conversations/by-phone/[phoneNumber]
 * 
 * Returns the latest active conversation for a phone number (used for clients).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ phoneNumber: string }> }
) {
  try {
    await connectDB();

    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { phoneNumber } = await params;
    const normalizedPhone = normalizePhone(phoneNumber);

    // Find the latest conversation for this phone number
    const conversation = await ConversationModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      phoneNumber: phoneMatchQuery(normalizedPhone),
    })
      .sort({ lastMessageAt: -1 })
      .lean();

    if (!conversation) {
      return NextResponse.json({ conversation: null });
    }

    return NextResponse.json({
      conversation: {
        _id: conversation._id,
        lifecycleState: conversation.lifecycleState,
        owner: conversation.owner,
        resolvedAt: conversation.resolvedAt,
        waitingMessageCount: conversation.waitingMessageCount,
        waitingPriority: conversation.waitingPriority,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}