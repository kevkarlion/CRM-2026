import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';

// Get leads for current user (from header)
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const tenantId = req.headers.get('x-tenant-id');
    
    return NextResponse.json({ 
      tenantId,
      message: 'Check your browser console for the tenantId' 
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}