import { NextRequest, NextResponse } from 'next/server';
import { WorkOrderService, ValidationError, ConflictError } from '@/operations/services/work-order.service';
import { TransitionError } from '@/operations/helpers/state-machine';
import type { TransitionContext } from '@/operations/helpers/state-machine';
import type { WorkOrderStatus } from '@/operations/types/work-order';

const service = new WorkOrderService();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenantId = _request.headers.get('x-tenant-id') || '';
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 400 });
    }

    const data = await service.findById(id, tenantId);
    if (!data) {
      return NextResponse.json({ error: 'WorkOrder not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

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

    const body = await request.json() as { version: number; status?: string; [key: string]: unknown };
    const { version, status: targetStatus, ...data } = body;

    if (version === undefined || version === null) {
      return NextResponse.json({ error: 'version is required for OCC' }, { status: 400 });
    }

    const updated = await service.update(id, data, tenantId, userId, version);
    if (!updated) {
      return NextResponse.json({ error: 'WorkOrder not found' }, { status: 404 });
    }

    if (targetStatus && updated.status !== targetStatus) {
      const context: TransitionContext = {};
      if (data.scheduledDate || data.scheduledStart || data.scheduledEnd) {
        context.hasSchedule = true;
      }
      await service.changeStatus(id, targetStatus as WorkOrderStatus, context, tenantId, userId, updated.version);
    }

    const refreshed = await service.findById(id, tenantId);
    return NextResponse.json({ data: refreshed });
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof TransitionError) {
      return NextResponse.json({ error: error.message, reason: error.reason }, { status: 422 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    const deleted = await service.softDelete(id, tenantId, userId);
    if (!deleted) {
      return NextResponse.json({ error: 'WorkOrder not found' }, { status: 404 });
    }

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
