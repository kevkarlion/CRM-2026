import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { documentService } from '@/documents/services/document.service';

/**
 * GET /api/crm/documents/[id]/download
 * 
 * Redirects to the Cloudinary URL with fl_attachment=true
 * to force download with the original filename
 */
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const document = await documentService.findById(id, tenantId);
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Verify tenant matches
    if (document.tenantId.toString() !== tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Build download URL with fl_attachment
    const secureUrl = document.secureUrl;
    const downloadUrl = secureUrl + (secureUrl.includes('?') ? '&' : '?') + 'fl_attachment=true';

    return NextResponse.redirect(downloadUrl);
  } catch (error) {
    console.error('[Document Download] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Download failed' },
      { status: 500 }
    );
  }
}