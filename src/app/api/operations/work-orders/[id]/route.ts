import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { WorkOrderService, ValidationError, ConflictError } from '@/operations/services/work-order.service';
import { workAssignmentService } from '@/operations/services/work-assignment.service';
import { TransitionError } from '@/operations/helpers/state-machine';
import type { TransitionContext } from '@/operations/helpers/state-machine';
import type { WorkOrderStatus } from '@/operations/types/work-order';
import { Types } from 'mongoose';

const service = new WorkOrderService();

// Helper: resolve workOrderId from param (could be _id or workOrderNumber)
async function resolveWorkOrderId(id: string, tenantId: string): Promise<string> {
  const WorkOrderModel = (await import('@/operations/models/work-order')).default;
  // Try as ObjectId first
  if (Types.ObjectId.isValid(id) && id.length === 24) {
    const wo = await WorkOrderModel.findOne({ _id: id, tenantId, deletedAt: null }).select('_id').lean();
    if (wo) return id;
  }
  // Try as workOrderNumber
  const woByNumber = await WorkOrderModel.findOne({ workOrderNumber: id, tenantId, deletedAt: null }).select('_id').lean();
  if (woByNumber) return String(woByNumber._id);
  // Return original - let it fail downstream
  return id;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id') || '';
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 400 });
    }

    const workOrderId = await resolveWorkOrderId(id, tenantId);
    const data = await service.findById(workOrderId, tenantId);
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
    await connectDB();
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id') || '';
    const userId = request.headers.get('x-user-id') || '';
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'x-tenant-id and x-user-id headers are required' }, { status: 400 });
    }

    // Resolve workOrderId (could be _id or workOrderNumber)
    const workOrderId = await resolveWorkOrderId(id, tenantId);

    const body = await request.json() as { version: number; status?: string; [key: string]: unknown };
    const { version, status: targetStatus, ...data } = body;

    if (version === undefined || version === null) {
      return NextResponse.json({ error: 'version is required for OCC' }, { status: 400 });
    }

    const updated = await service.update(workOrderId, data, tenantId, userId, version);
    if (!updated) {
      return NextResponse.json({ error: 'WorkOrder not found' }, { status: 404 });
    }

    if (targetStatus && updated.status !== targetStatus) {
      const context: TransitionContext = {};
      if (data.scheduledDate || data.scheduledStart || data.scheduledEnd) {
        context.hasSchedule = true;
      }
      await service.changeStatus(workOrderId, targetStatus as WorkOrderStatus, context, tenantId, userId, updated.version);
    }

    const refreshed = await service.findById(workOrderId, tenantId);
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
    await connectDB();
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id') || '';
    const userId = request.headers.get('x-user-id') || '';
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'x-tenant-id and x-user-id headers are required' }, { status: 400 });
    }

    const workOrderId = await resolveWorkOrderId(id, tenantId);
    const deleted = await service.softDelete(workOrderId, tenantId, userId);
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
