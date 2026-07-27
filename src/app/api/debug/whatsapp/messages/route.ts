import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    const query: any = { tenantId: new Types.ObjectId('000000000000000000000001') };
    if (phone) query.phone = phone;

    const messages = await WhatsAppMessageModel.find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // También buscar leads con esos teléfonos
    const phones = [...new Set(messages.map(m => m.phone))];
    const leads = await LeadModel.find({ phone: { $in: phones } })
      .select('name phone')
      .lean();

    return NextResponse.json({ messages, leads });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}