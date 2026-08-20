import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { Types } from 'mongoose';

/**
 * Direct MongoDB update for profileName
 * POST /api/debug/force-update-client
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const mongoose = await connectDB();
    const db = mongoose.connection.db;
    
    const { clientId, profileName } = await request.json();
    
    if (!clientId || !profileName) {
      return NextResponse.json({ error: 'clientId and profileName required' }, { status: 400 });
    }

    const result = await db.collection('clients').updateOne(
      { _id: new Types.ObjectId(clientId) },
      { $set: { profileName } }
    );

    return NextResponse.json({
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
