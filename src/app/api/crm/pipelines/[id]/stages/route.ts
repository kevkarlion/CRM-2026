import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { PipelineService } from '@/leads/services';

const service = new PipelineService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id') || '';
    const userId = request.headers.get('x-user-id') || '';
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'x-tenant-id and x-user-id headers are required' }, { status: 400 });
    }

    const body = await request.json() as { name: string; probability: number; position?: number };
    if (!body.name || body.probability === undefined) {
      return NextResponse.json(
        { error: 'name and probability are required' },
        { status: 400 },
      );
    }

    const updated = await service.addStage(id, { name: body.name, probability: body.probability }, userId, tenantId);

    if (!updated) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    return NextResponse.json({ data: updated }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
