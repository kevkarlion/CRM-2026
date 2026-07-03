import { NextRequest, NextResponse } from 'next/server';
import { WorkOrderService, ConflictError } from '@/operations/services/work-order.service';
import type { WorkOrderStatus } from '@/operations/types/work-order';
import { TransitionError } from '@/operations/helpers/state-machine';

const service = new WorkOrderService();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id') || '';
    const userId = request.headers.get('x-user-id') || '';
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'x-tenant-id and x-user-id headers are required' }, { status: 400 });
    }

    const body = await request.json() as { status: string; version: number; context?: Record<string, unknown> };
    const { status: targetStatus, version, context } = body;

    if (!targetStatus || version === undefined || version === null) {
      return NextResponse.json({ error: 'status and version are required' }, { status: 400 });
    }

    const updated = await service.changeStatus(
      id,
      targetStatus as WorkOrderStatus,
      context || {},
      tenantId,
      userId,
      version,
    );

    if (!updated) {
      return NextResponse.json({ error: 'WorkOrder not found' }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof TransitionError) {
      return NextResponse.json({ error: error.message, reason: error.reason }, { status: 422 });
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
