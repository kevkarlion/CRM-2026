import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';
import ClientModel from '@/crm/models/client';
import { Types } from 'mongoose';

/**
 * GET /api/debug/check-converted-leads
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // Find all leads with convertedToClient (ignoring tenant for debug)
    const convertedLeads = await LeadModel.find({
      convertedToClient: { $exists: true, $ne: null },
    }).limit(20).lean();

    const results = convertedLeads.map(lead => ({
      leadId: lead._id,
      leadName: lead.name,
      leadProfileName: (lead as any).profileName,
      leadCompanyName: (lead as any).companyName,
      convertedToClient: (lead as any).convertedToClient,
      tenantId: lead.tenantId,
    }));

    return NextResponse.json({ convertedLeads: results });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}
