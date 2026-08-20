import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';

/**
 * Debug: find converted leads
 * GET /api/debug/find-leads
 */
export async function GET() {
  try {
    await connectDB();
    
    // Find all leads with convertedToClient
    const leads = await LeadModel.find({
      convertedToClient: { $exists: true, $ne: null },
    }).limit(5).lean();

    return NextResponse.json({ 
      count: leads.length,
      leads: leads.map(l => ({
        _id: l._id,
        name: l.name,
        profileName: (l as any).profileName,
        companyName: (l as any).companyName,
        convertedToClient: (l as any).convertedToClient,
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
