import { NextRequest, NextResponse } from 'next/server';
import { ConversionService, ConversionError } from '@/src/quotes/services';

const service = new ConversionService();

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

    const body = await request.json();
    const { priority, category } = body || {};
    const options = { priority, category };

    const result = await service.convertToWorkOrder(params.id, userId, tenantId, options);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ConversionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
