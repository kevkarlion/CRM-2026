import { NextRequest, NextResponse } from 'next/server';
import QuoteModel from '@/quotes/models/quote';
import { cursorPage } from '@/crm/helpers/cursor-pagination';
import type { IQuote } from '@/quotes/types/quote';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await cursorPage<IQuote>(
      QuoteModel,
      { tenantId, leadId: id, deletedAt: null },
      { sortField: 'createdAt', sortOrder: -1, cursor, limit }
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
