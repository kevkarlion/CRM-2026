import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { WorkOrderModel } from '@/operations/models';
import { TechnicianModel } from '@/operations/models/technician';
import WorkOrderAssignmentModel from '@/operations/models/work-order-assignment';
import { WorkReportService } from '@/operations/services/work-report.service';
import { logActivity } from '@/audit/activity-logger';
import { eventBus } from '@/infrastructure/events/event-bus';
import { DOMAIN_EVENTS, WorkOrderCompletedPayload } from '@/infrastructure/events/event.types';
import { broadcastWorkReportCompleted } from '@/lib/sse-broadcast';
import mongoose from 'mongoose';

const VALID_STATUSES = ['in_progress'] as const;
const TARGET_STATUS = 'closed';

interface WorkReportInput {
  result: string;
  workPerformed?: string[];
  workPerformedOther?: string;
  hasObservations?: boolean;
  observationsText?: string;
  hasAdditionalIssues?: boolean;
  additionalIssues?: string[];
  additionalIssuesText?: string;
  nextVisitRecommendation?: string;
}

/**
 * POST /api/operations/work-orders/[id]/complete
 * 
 * Completes work execution on a WorkOrder.
 * - Validates status is 'in_progress'
 * - Validates result field is required
 * - Creates WorkReport
 * - Changes status to 'completed'
 * - Sets finishedAt and workReportId
 * - Sets technician.availability to 'available'
 * - Logs 'work_completed' and 'work_report_created' activities
 * - Rolls back on failure
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // IMPORTANT: connect BEFORE starting a session - otherwise Mongoose buffers
  // operations and can time out on cold starts (e.g. Vercel serverless).
  await connectDB();
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id: workOrderId } = await params;
    
    const tenantId = request.headers.get('x-tenant-id') || '';
    const userId = request.headers.get('x-user-id') || '';
    
    if (!tenantId || !userId) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: 'x-tenant-id and x-user-id headers are required' },
        { status: 400 }
      );
    }

    const body = await request.json() as WorkReportInput;
    
    // Validate required fields
    if (!body.result) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: 'Result is required' },
        { status: 400 }
      );
    }

    // Find the WorkOrder
    const workOrder = await WorkOrderModel.findOne({
      _id: new mongoose.Types.ObjectId(workOrderId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      deletedAt: null,
    }).session(session);

    if (!workOrder) {
      await session.abortTransaction();
      return NextResponse.json({ error: 'WorkOrder not found' }, { status: 404 });
    }

    // Check status is 'in_progress'
    if (workOrder.status !== 'in_progress') {
      await session.abortTransaction();
      return NextResponse.json(
        { error: `Work must be in progress to complete. Current status: ${workOrder.status}` },
        { status: 400 }
      );
    }

    // Find the active assignment for this work order and get the technician
    let assignment = await WorkOrderAssignmentModel.findOne({
      workOrderId: new mongoose.Types.ObjectId(workOrderId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      status: { $in: ['assigned', 'acknowledged', 'in_progress'] },
      deletedAt: null,
    }).populate('technicianId').session(session);

    // If no assignment found, check assignedTechnicians array on the work order
    let technician: any = null;
    if (!assignment && workOrder.assignedTechnicians?.length > 0) {
      const techId = workOrder.assignedTechnicians[0];
      technician = await TechnicianModel.findById(techId).session(session);
    } else if (assignment) {
      technician = assignment.technicianId as any;
    }

    if (!technician) {
      await session.abortTransaction();
      return NextResponse.json({ error: 'No active technician assignment found' }, { status: 404 });
    }

    // Verify the current user is the assigned technician (via userId)
    if (!technician || technician.userId?.toString() !== userId) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: 'Only the assigned technician can complete this work' },
        { status: 403 }
      );
    }

    const technicianId = technician._id;
    const now = new Date();
    const startedAt = workOrder.startedAt || now;

    // Calculate duration in minutes
    const duration = Math.round((now.getTime() - startedAt.getTime()) / 60000);

    // Prepare WorkReport data
    const workReportData = {
      result: body.result,
      workPerformed: body.workPerformed,
      workPerformedOther: body.workPerformedOther,
      hasObservations: body.hasObservations,
      observationsText: body.observationsText,
      hasAdditionalIssues: body.hasAdditionalIssues,
      additionalIssues: body.additionalIssues,
      additionalIssuesText: body.additionalIssuesText,
      nextVisitRecommendation: body.nextVisitRecommendation,
      startedAt: startedAt,
      finishedAt: now,
      technicianId: technicianId.toString(),
    };

    // Validate WorkReport input
    const workReportService = new WorkReportService();
    const validation = workReportService.validateWorkReportInput(workReportData);
    
    if (!validation.valid) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: validation.errors.join(', ') },
        { status: 400 }
      );
    }

    // Create WorkReport
    const workReport = await workReportService.createForWorkOrder(
      workOrderId,
      workReportData,
      tenantId,
      userId
    );

    // Update WorkOrder status and set workReportId
    await WorkOrderModel.findByIdAndUpdate(workOrderId, {
      $set: {
        status: TARGET_STATUS,
        finishedAt: now,
        closedAt: now,
        duration: duration,
        workReportId: workReport._id,
        updatedBy: new mongoose.Types.ObjectId(userId),
      },
    }).session(session);

    // Set technician availability back to 'available'
    await TechnicianModel.findByIdAndUpdate(technicianId, {
      $set: {
        availability: 'available',
        updatedBy: new mongoose.Types.ObjectId(userId),
      },
    }).session(session);

    // Commit transaction
    await session.commitTransaction();

    // Broadcast SSE event to connected admin clients (real-time toast)
    const techName = technician ? 
      `${(technician as any).firstName || ''} ${(technician as any).lastName || ''}`.trim() || (technician as any).name || 'Técnico' 
      : 'Técnico';

    try {
      broadcastWorkReportCompleted({
        workOrderId: workOrderId.toString(),
        workReportId: workReport._id.toString(),
        workOrderNumber: workOrder.workOrderNumber,
        technicianName: techName,
        clientId: (workOrder as any).clientId?.toString(),
        title: workOrder.title,
      });
    } catch (broadcastError) {
      console.error('[WorkOrder Complete] Failed to broadcast SSE:', broadcastError);
    }

    // Publish WORK_ORDER_COMPLETED event for timeline
    try {
      await eventBus.publish({
        type: DOMAIN_EVENTS.WORK_ORDER_COMPLETED,
        aggregateId: workOrderId.toString(),
        aggregateType: 'WorkOrder',
        tenantId,
        userId,
        timestamp: now,
        payload: {
          workOrderId: workOrderId.toString(),
          workReportId: workReport._id.toString(),
          number: workOrder.workOrderNumber,
          technicianName: techName,
        } as WorkOrderCompletedPayload,
      });
    } catch (eventError) {
      console.error('[WorkOrder Complete] Failed to publish event:', eventError);
    }

    // Log activities (outside transaction - best effort)
    try {
      await logActivity({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        entityType: 'workOrder',
        entityId: new mongoose.Types.ObjectId(workOrderId),
        action: 'work_completed',
        actorId: new mongoose.Types.ObjectId(userId),
        metadata: {
          workOrderNumber: workOrder.workOrderNumber,
          title: workOrder.title,
          previousStatus: 'in_progress',
          newStatus: TARGET_STATUS,
          technicianId: technicianId.toString(),
          technicianName: techName,
          result: body.result,
          workReportId: workReport._id.toString(),
          duration,
          scheduledDate: workOrder.scheduledDate,
          closedAt: new Date().toISOString(),
        },
      });

      await logActivity({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        entityType: 'workReport',
        entityId: workReport._id,
        action: 'work_report_created',
        actorId: new mongoose.Types.ObjectId(userId),
        metadata: {
          workOrderId: workOrderId.toString(),
          technicianId: technicianId.toString(),
          result: body.result,
        },
      });
    } catch (logError) {
      console.error('[WorkOrder Complete] Failed to log activity:', logError);
    }

    return NextResponse.json({
      success: true,
      data: {
        status: TARGET_STATUS,
        finishedAt: now.toISOString(),
        workReportId: workReport._id.toString(),
        duration,
      },
    });
  } catch (error) {
    // Rollback: set technician availability back to 'available'
    try {
      const tenantId = request.headers.get('x-tenant-id') || '';
      const userId = request.headers.get('x-user-id') || '';
      
      if (tenantId && userId) {
        // Find technician from the assignment and rollback
        const { id: workOrderId } = await params;
        const assignment = await WorkOrderAssignmentModel.findOne({
          workOrderId: new mongoose.Types.ObjectId(workOrderId),
          tenantId: new mongoose.Types.ObjectId(tenantId),
          status: { $in: ['assigned', 'acknowledged'] },
          deletedAt: null,
        }).populate('technicianId');

        if (assignment) {
          const technician = assignment.technicianId as any;
          if (technician) {
            await TechnicianModel.findByIdAndUpdate(technician._id, {
              $set: { availability: 'available' },
            });
          }
        }
      }
    } catch (rollbackError) {
      console.error('[WorkOrder Complete] Rollback failed:', rollbackError);
    }

    await session.abortTransaction();
    
    console.error('[WorkOrder Complete] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}