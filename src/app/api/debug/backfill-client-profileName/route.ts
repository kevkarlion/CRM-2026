import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import ClientModel from '@/crm/models/client';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';

/**
 * POST /api/debug/backfill-client-profileName
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // Get all converted leads
    const convertedLeads = await LeadModel.find({
      convertedToClient: { $exists: true, $ne: null },
      profileName: { $exists: true, $ne: null },
    }).lean();

    let updated = 0;
    const results: any[] = [];

    for (const lead of convertedLeads) {
      const clientId = (lead as any).convertedToClient;
      const profileName = (lead as any).profileName;
      
      if (clientId && profileName) {
        const result = await ClientModel.findByIdAndUpdate(
          clientId,
          { $set: { profileName } },
          { new: true }
        );
        
        if (result) {
          updated++;
          results.push({
            leadId: lead._id,
            clientId,
            profileName,
          });
        }
      }
    }

    return NextResponse.json({
      message: `Updated ${updated} clients`,
      details: results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: 'POST to backfill' });
}
