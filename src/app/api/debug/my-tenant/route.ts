import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
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
      { error: errorMessage(error, 'Internal error') },
      { status: 500 }
    );
  }
}