import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import { Types } from 'mongoose';

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const tenantId = req.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenantId found. Are you logged in?' }, { status: 401 });
    }

    const leads = await LeadModel.find({ 
      tenantId: new Types.ObjectId(tenantId)
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

    const messages = await WhatsAppMessageModel.find({ 
      tenantId: new Types.ObjectId(tenantId)
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

    return NextResponse.json({ 
      tenantId,
      leads, 
      messages 
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}