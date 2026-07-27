import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import { Types } from 'mongoose';

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    // Accept tenantId from query param or header
    let tenantId = req.nextUrl.searchParams.get('tenantId') || req.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json({ 
        error: 'No tenantId provided. Use ?tenantId=xxx or x-tenant-id header',
        hint: 'Try: /api/debug/my-data?tenantId=000000000000000000000001'
      }, { status: 400 });
    }

    const leads = await LeadModel.find({ 
      tenantId: new Types.ObjectId(tenantId)
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

    const messages = await WhatsAppMessageModel.find({ 
      tenantId: new Types.ObjectId(tenantId)
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

    return NextResponse.json({ 
      tenantId,
      leads: leads.map(l => ({
        _id: String(l._id),
        name: l.name,
        phone: l.phone,
        status: l.status,
        source: l.source
      })), 
      messages: messages.map(m => ({
        _id: String(m._id),
        phone: m.phone,
        content: m.content,
        direction: m.direction,
        leadId: m.leadId ? String(m.leadId) : null
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}