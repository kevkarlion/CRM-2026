import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    const tenantId = req.headers.get('x-tenant-id');
    
    const query: Record<string, unknown> = {};
    
    if (tenantId) {
      query.tenantId = require('mongoose').Types.ObjectId.createFromHexString(tenantId);
    }
    
    if (phone) {
      query.phone = { $regex: new RegExp(phone) };
    }
    
    const messages = await WhatsAppMessageModel.find(query)
      .select('phone content direction createdAt leadId')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    
    // Get unique phones
    const phones = [...new Set(messages.map(m => m.phone))];
    
    return NextResponse.json({ 
      totalMessages: messages.length,
      uniquePhones: phones,
      recentMessages: messages.slice(0, 10)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    );
  }
}