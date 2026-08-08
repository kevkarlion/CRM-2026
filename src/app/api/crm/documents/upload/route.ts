import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { documentService } from '@/documents/services/document.service';

/**
 * POST /api/crm/documents/upload
 * 
 * Upload a document file.
 * Multipart form data with: file, clientId (optional), leadId (optional), 
 * title (optional), description (optional), documentType (optional)
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const userId = req.headers.get('x-user-id') || undefined;

    const formData = await req.formData();
    
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // Get other fields
    const clientId = formData.get('clientId') as string | null;
    const leadId = formData.get('leadId') as string | null;
    const title = formData.get('title') as string | null;
    const description = formData.get('description') as string | null;
    const documentType = formData.get('documentType') as string | null;

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload and create document
    const document = await documentService.uploadAndCreate(
      {
        buffer,
        originalname: file.name,
        mimetype: file.type,
        size: file.size,
      },
      {
        tenantId,
        clientId: clientId || undefined,
        leadId: leadId || undefined,
        title: title || undefined,
        description: description || undefined,
        documentType: documentType as any || 'otro',
        source: 'crm',
        createdBy: userId,
      }
    );

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('[Document Upload] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}