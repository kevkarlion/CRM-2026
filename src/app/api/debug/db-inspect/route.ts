import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import { Types } from 'mongoose';

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const tenantId = new Types.ObjectId('000000000000000000000001');

    const leads = await LeadModel.find({ 
      tenantId,
      phone: { $exists: true }
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

    const messages = await WhatsAppMessageModel.find({ tenantId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return NextResponse.json({ leads, messages });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal error') },
      { status: 500 }
    );
  }
}