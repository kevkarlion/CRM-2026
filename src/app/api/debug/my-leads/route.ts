import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get('id');
    
    if (leadId) {
      const lead = await LeadModel.findById(leadId)
        .select('name phone status convertedToClient inquiryReason customerType notes createdAt')
        .lean();
      
      return NextResponse.json({ lead });
    }
    
    // Otherwise return all leads
    const leads = await LeadModel.find({ deletedAt: null })
      .select('name phone status convertedToClient inquiryReason createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    
    return NextResponse.json({ 
      count: leads.length,
      leads 
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    );
  }
}