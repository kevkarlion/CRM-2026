import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ClientModel from '@/crm/models/client';

/**
 * Debug: check a client directly
 * GET /api/debug/check-client/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();
    
    // Use findOne to get the full document including profileName
    const client = await ClientModel.findOne({ _id: id }).lean();
    
    return NextResponse.json({ 
      hasProfileName: !!client?.profileName,
      profileName: client?.profileName,
      fullDoc: client 
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
