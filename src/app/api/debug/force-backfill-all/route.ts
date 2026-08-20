import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ClientModel from '@/crm/models/client';

/**
 * Force update ALL clients from their leads
 * POST /api/debug/force-backfill-all
 */
export async function POST() {
  try {
    await connectDB();
    
    const Client = ClientModel;
    
    // Get all clients
    const clients = await Client.find({}).lean();
    
    let updated = 0;
    const results: any[] = [];
    
    for (const client of clients) {
      // Try to find a lead that was converted to this client
      const Lead = (await import('@/leads/models/lead')).default;
      const lead = await Lead.findOne({ convertedToClient: client._id }).lean();
      
      if (lead && (lead as any).profileName) {
        const profileName = (lead as any).profileName;
        await Client.updateOne(
          { _id: client._id },
          { $set: { profileName } }
        );
        updated++;
        results.push({ clientId: client._id, profileName });
      }
    }

    return NextResponse.json({
      message: `Updated ${updated} clients`,
      details: results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: 'POST to force backfill' });
}
