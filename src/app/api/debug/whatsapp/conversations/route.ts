import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import { Types } from 'mongoose';

// Debug endpoint to list conversations without auth
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId') || '000000000000000000000001';

    // Aggregate last message per phone
    const lastMessages = await WhatsAppMessageModel.aggregate([
      { $match: { tenantId: new Types.ObjectId(tenantId) } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$phone',
          lastMessage: {
            $first: {
              content: '$content',
              direction: '$direction',
              type: '$type',
              createdAt: '$createdAt',
            },
          },
          totalMessages: { $sum: 1 },
          lastActivity: { $first: '$createdAt' },
        },
      },
      { $sort: { lastActivity: -1 } },
      { $limit: 50 },
    ]);

    return NextResponse.json({ conversations: lastMessages });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}