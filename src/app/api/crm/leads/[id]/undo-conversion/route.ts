import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';

/**
 * POST /api/crm/leads/[id]/undo-conversion
 * Deshace la conversión a cliente: removes client reference, keeps lead as won
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const lead = await LeadModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      },
      {
        $set: {
          convertedToClient: null,
          clientId: null,
        },
        // Keep status as 'won'
      },
      { new: true }
    ).lean();

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      lead: {
        _id: lead._id,
        status: lead.status,
        name: lead.name,
        convertedToClient: lead.convertedToClient,
        clientId: lead.clientId,
      },
    });
  } catch (error) {
    console.error('[UndoConversion] Error:', error);
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}
