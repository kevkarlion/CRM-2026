import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import QuoteModel from '@/quotes/models/quote';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    await connectDB();

    const { id } = await params;

    const quotes = await QuoteModel.find({
      tenantId,
      leadId: id,
      deletedAt: null,
    })
      .select('_id number title total status')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const formatted = quotes.map((q) => ({
      _id: String(q._id),
      number: q.number,
      title: q.title,
      total: q.total || 0,
      status: q.status,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
