import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import ClientModel from '@/crm/models/client';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';

/**
 * Debug: show clients missing profileName
 * GET /api/debug/missing-profile-names
 */
export async function GET() {
  try {
    await connectDB();
    
    // Find clients without profileName
    const clientsWithoutProfile = await ClientModel.find({
      profileName: { $exists: false }
    }).limit(20).lean();

    // Find converted leads with profileName
    const leadsWithProfile = await LeadModel.find({
      convertedToClient: { $exists: true, $ne: null },
      profileName: { $exists: true, $ne: null },
    }).lean();

    // Match them
    const toUpdate = leadsWithProfile.filter(l => {
      const clientId = (l as any).convertedToClient;
      return clientsWithoutProfile.some(c => String(c._id) === String(clientId));
    });

    return NextResponse.json({ 
      clientsWithoutProfile: clientsWithoutProfile.length,
      leadsWithProfile: leadsWithProfile.length,
      toUpdate: toUpdate.map(l => ({
        leadId: l._id,
        clientId: (l as any).convertedToClient,
        profileName: (l as any).profileName,
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}
