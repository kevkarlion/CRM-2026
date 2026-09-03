import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';

/**
 * Debug: get messages for phone exact match
 * GET /api/debug/messages-exact/[phone]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    await connectDB();
    const { phone } = await params;
    
    // Try exact match first
    let messages = await WhatsAppMessageModel.find({
      phone: phone,
    }).sort({ createdAt: -1 }).limit(5).lean();

    // If no messages, try partial match
    if (messages.length === 0) {
      messages = await WhatsAppMessageModel.find({
        phone: { $regex: phone.slice(-9) }
      }).sort({ createdAt: -1 }).limit(5).lean();
    }

    return NextResponse.json({ 
      count: messages.length,
      messages: messages.map(m => ({
        _id: m._id,
        phone: m.phone,
        direction: m.direction,
        content: m.content?.substring(0, 30),
        createdAt: m.createdAt,
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}
