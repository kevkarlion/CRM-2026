import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';

/**
 * Direct MongoDB backfill for all converted leads
 * POST /api/debug/backfill-all-clients
 */
export async function POST(request: NextRequest) {
  try {
    const mongoose = await connectDB();
    const db = mongoose.connection.db;

    // Get all converted leads with profileName
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
        const result = await db.collection('clients').updateOne(
          { _id: new Types.ObjectId(clientId) },
          { $set: { profileName } }
        );
        
        if (result.modifiedCount > 0) {
          updated++;
          results.push({ clientId, profileName });
        }
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
  return NextResponse.json({ message: 'POST to backfill all clients' });
}
