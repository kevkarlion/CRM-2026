import { NextRequest, NextResponse } from 'next/server';
import { QuoteService, NotFoundError, ConflictError } from '@/quotes/services';
import { TransitionError } from '@/quotes/helpers/state-machine';

const service = new QuoteService();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await service.sendQuote(params.id, userId, tenantId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof TransitionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
