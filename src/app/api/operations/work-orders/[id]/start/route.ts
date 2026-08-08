import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { WorkOrderModel } from '@/operations/models';
import { TechnicianModel } from '@/operations/models/technician';
import WorkOrderAssignmentModel from '@/operations/models/work-order-assignment';
import { logActivity } from '@/audit/activity-logger';
import { eventBus } from '@/infrastructure/events/event-bus';
import { DOMAIN_EVENTS, WorkOrderStartedPayload } from '@/infrastructure/events/event.types';
import mongoose from 'mongoose';

const VALID_STATUSES = ['scheduled', 'assigned'] as const;
const TARGET_STATUS = 'in_progress';

/**
 * POST /api/operations/work-orders/[id]/start
 * 
 * Starts work execution on a WorkOrder.
 * - Validates user is the assigned technician
 * - Allows start when status is 'scheduled' or 'assigned'
 * - Changes status to 'in_progress'
 * - Sets startedAt and startedBy
 * - Sets technician.availability to 'busy'
 * - Logs 'work_started' activity
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: workOrderId } = await params;
    
    const tenantId = request.headers.get('x-tenant-id') || '';
    const userId = request.headers.get('x-user-id') || '';
    
    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'x-tenant-id and x-user-id headers are required' },
        { status: 400 }
      );
    }

    // Find the WorkOrder
    const workOrder = await WorkOrderModel.findOne({
      _id: new mongoose.Types.ObjectId(workOrderId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      deletedAt: null,
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'WorkOrder not found' }, { status: 404 });
    }

    // Check status is 'scheduled' or 'assigned'
    if (!(VALID_STATUSES as readonly string[]).includes(workOrder.status)) {
      return NextResponse.json(
        { error: workOrder.status === 'in_progress' ? 'Work already in progress' : `Cannot start work from status: ${workOrder.status}` },
        { status: 400 }
      );
    }

    // Find the active assignment for this work order and get the technician
    const assignment = await WorkOrderAssignmentModel.findOne({
      workOrderId: new mongoose.Types.ObjectId(workOrderId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      status: { $in: ['assigned', 'acknowledged'] },
      deletedAt: null,
    }).populate('technicianId');

    if (!assignment) {
      return NextResponse.json({ error: 'No active technician assignment found' }, { status: 404 });
    }

    const technician = assignment.technicianId;
    
    // Verify the current user is the assigned technician (via userId)
    if (!technician || (technician as any).userId?.toString() !== userId) {
      return NextResponse.json(
        { error: 'Only the assigned technician can start this work' },
        { status: 403 }
      );
    }

    const technicianId = (technician as any)._id;
    const now = new Date();

    // Update WorkOrder status
    await WorkOrderModel.findByIdAndUpdate(workOrderId, {
      $set: {
        status: TARGET_STATUS,
        startedAt: now,
        startedBy: new mongoose.Types.ObjectId(userId),
        updatedBy: new mongoose.Types.ObjectId(userId),
      },
    });

    // Set technician availability to 'busy'
    await TechnicianModel.findByIdAndUpdate(technicianId, {
      $set: {
        availability: 'busy',
        updatedBy: new mongoose.Types.ObjectId(userId),
      },
    });

    // Publish WORK_ORDER_STARTED event for timeline
    console.log('[WorkOrder Start] Publishing WORK_ORDER_STARTED for:', workOrderId, 'tech:', (technician as any).name);
    try {
      await eventBus.publish({
        type: DOMAIN_EVENTS.WORK_ORDER_STARTED,
        aggregateId: workOrderId,
        aggregateType: 'WorkOrder',
        tenantId,
        userId,
        timestamp: now,
        payload: {
          workOrderId,
          number: workOrder.workOrderNumber,
          technicianId: technicianId.toString(),
          technicianName: (technician as any).name || 'Técnico',
        } as WorkOrderStartedPayload,
      });
    } catch (eventError) {
      console.error('[WorkOrder Start] Failed to publish event:', eventError);
    }

    // Log activity
    const techName = technician ? 
      `${(technician as any).firstName || ''} ${(technician as any).lastName || ''}`.trim() || (technician as any).name || 'Técnico' 
      : 'Técnico';
    
    await logActivity({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      entityType: 'workOrder',
      entityId: new mongoose.Types.ObjectId(workOrderId),
      action: 'work_started',
      actorId: new mongoose.Types.ObjectId(userId),
      metadata: {
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        previousStatus: workOrder.status,
        newStatus: TARGET_STATUS,
        technicianId: technicianId.toString(),
        technicianName: techName,
        scheduledDate: workOrder.scheduledDate,
        priority: workOrder.priority,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        status: TARGET_STATUS,
        startedAt: now.toISOString(),
        startedBy: userId,
      },
    });
  } catch (error) {
    console.error('[WorkOrder Start] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}