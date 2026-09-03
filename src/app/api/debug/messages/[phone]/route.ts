import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';

/**
 * Debug: get messages for phone
 * GET /api/debug/messages/[phone]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    await connectDB();
    const { phone } = await params;
    
    const messages = await WhatsAppMessageModel.find({
      phone: phone,
    }).sort({ createdAt: -1 }).limit(10).lean();

    return NextResponse.json({ 
      count: messages.length,
      lastMessage: messages[0]?.content?.substring(0, 50),
      lastMessageAt: messages[0]?.createdAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}
