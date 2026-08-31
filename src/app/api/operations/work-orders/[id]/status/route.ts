import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { WorkOrderService, ValidationError, ConflictError } from '@/operations/services/work-order.service';
import { TransitionError, validateTransition } from '@/operations/helpers/state-machine';
import type { WorkOrderStatus } from '@/operations/types/work-order';
import { workAssignmentService } from '@/operations/services/work-assignment.service';
import { Types } from 'mongoose';

const service = new WorkOrderService();

// Helper: resolve workOrderId from param (could be _id or workOrderNumber)
async function resolveWorkOrderId(id: string, tenantId: string): Promise<string> {
  const WorkOrderModel = (await import('@/operations/models/work-order')).default;
  if (Types.ObjectId.isValid(id) && id.length === 24) {
    const wo = await WorkOrderModel.findOne({ _id: id, tenantId, deletedAt: null }).select('_id').lean();
    if (wo) return id;
  }
  const woByNumber = await WorkOrderModel.findOne({ workOrderNumber: id, tenantId, deletedAt: null }).select('_id').lean();
  if (woByNumber) return String(woByNumber._id);
  return id;
}

// POST /api/operations/work-orders/[id]/status
// Body: { status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled', version: number }
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

    const workOrderId = await resolveWorkOrderId(id, tenantId);
    const workOrder = await service.findById(workOrderId, tenantId);
    
    if (!workOrder) {
      return NextResponse.json({ error: 'WorkOrder not found' }, { status: 404 });
    }

    const body = await request.json() as {
      status: WorkOrderStatus;
      version: number;
    };

    const { status: targetStatus, version } = body;

    if (!targetStatus) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const validStatuses: WorkOrderStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(targetStatus)) {
      return NextResponse.json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      }, { status: 400 });
    }

    const currentStatus = workOrder.status;
    
    // Build context for validation
    const context = {
      hasTechnicians: workOrder.assignedTechnicians && workOrder.assignedTechnicians.length > 0,
      hasSchedule: !!(workOrder.scheduledDate || workOrder.scheduledStart),
      hasChecklist: false, // Will be validated separately
    };

    // Validate the transition
    try {
      validateTransition(currentStatus, targetStatus, context);
    } catch (e) {
      if (e instanceof TransitionError) {
        return NextResponse.json({ 
          error: e.message, 
          reason: e.reason,
          currentStatus,
          targetStatus,
        }, { status: 422 });
      }
      throw e;
    }

    // Execute the status change
    await service.changeStatus(workOrderId, targetStatus, context, tenantId, userId, version);

    const updated = await service.findById(workOrderId, tenantId);
    return NextResponse.json({ data: updated });
    
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
