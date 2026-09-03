import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import ClientModel from '@/crm/models/client';
import LeadModel from '@/leads/models/lead';

/**
 * Debug: show all converted leads with their clients
 * GET /api/debug/converted-leads-clients
 */
export async function GET() {
  try {
    await connectDB();
    
    // Find all converted leads with profileName
    const leads = await LeadModel.find({
      convertedToClient: { $exists: true, $ne: null },
      profileName: { $exists: true, $ne: null },
    }).lean();

    // Get their clients
    const results = [];
    for (const lead of leads) {
      const clientId = (lead as any).convertedToClient;
      const client = await ClientModel.findById(clientId).lean();
      results.push({
        leadId: lead._id,
        leadName: lead.name,
        leadProfileName: (lead as any).profileName,
        clientId: clientId,
        clientName: client?.fullName,
        clientProfileName: client?.profileName,
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}
