import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import DocumentModel from '@/documents/models/document';

/**
 * Debug: test document upload for client
 * GET /api/debug/test-doc-upload?clientId=xxx
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const tenantId = req.headers.get('x-tenant-id');
    
    if (!clientId) {
      return NextResponse.json({ error: 'clientId required' }, { status: 400 });
    }
    
    // Try to find existing docs for this client
    const existingDocs = await DocumentModel.find({
      clientId: new (require('mongoose').Types.ObjectId)(clientId),
    }).limit(5).lean();
    
    // Count total docs
    const totalDocs = await DocumentModel.countDocuments({
      clientId: new (require('mongoose').Types.ObjectId)(clientId),
    });
    
    return NextResponse.json({
      clientId,
      tenantId,
      existingDocsCount: existingDocs.length,
      totalDocs,
      sampleDocs: existingDocs.map(d => ({ _id: d._id, title: d.title })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
