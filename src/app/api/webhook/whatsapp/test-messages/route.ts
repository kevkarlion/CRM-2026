import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import { Types } from 'mongoose';

// POST: Inject a test message
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const { phone, content, direction = 'inbound', tenantId } = body;

    const tid = tenantId ? new Types.ObjectId(tenantId) : new Types.ObjectId('000000000000000000000001');

    const message = await WhatsAppMessageModel.create({
      tenantId: tid,
      phone: phone || '5491166699900',
      messageId: `test_${Date.now()}`,
      direction: direction,
      type: 'text',
      content: content || 'Mensaje de prueba desde WhatsApp',
      status: 'delivered',
    });

    return NextResponse.json({
      success: true,
      message: {
        _id: String(message._id),
        phone: message.phone,
        content: message.content,
        direction: message.direction,
        status: message.status,
        createdAt: message.createdAt,
      }
    });
  } catch (error) {
    console.error('Error injecting message:', error);
    return NextResponse.json(
      { error: errorMessage(error, 'Internal error') },
      { status: 500 }
    );
  }
}

// GET: List test messages
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId') || '000000000000000000000001';

    const messages = await WhatsAppMessageModel.find({ tenantId: new Types.ObjectId(tenantId) })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal error') },
      { status: 500 }
    );
  }
}