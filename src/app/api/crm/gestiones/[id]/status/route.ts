import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { GestionService, ConflictError } from '@/gestion/services/gestion.service';
import type { GestionStatus } from '@/gestion/types/gestion';

const service = new GestionService();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { status: string };
    const { status: targetStatus } = body;

    if (!targetStatus) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const updated = await service.changeStatus(id, targetStatus as GestionStatus, userId, tenantId);

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}