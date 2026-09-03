import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import { documentService } from '@/documents/services/document.service';
import { Types } from 'mongoose';

/**
 * GET /api/crm/documents
 * 
 * List documents for a client or lead.
 * Query params: clientId, leadId, limit, offset
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const leadId = searchParams.get('leadId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let documents;

    if (clientId) {
      documents = await documentService.findByClient(clientId, tenantId);
    } else if (leadId) {
      documents = await documentService.findByLead(leadId, tenantId);
    } else {
      return NextResponse.json({ error: 'clientId or leadId is required' }, { status: 400 });
    }

    // Apply pagination
    const paginated = documents.slice(offset, offset + limit);

    return NextResponse.json({
      documents: paginated,
      total: documents.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Documents GET] Error:', error);
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}