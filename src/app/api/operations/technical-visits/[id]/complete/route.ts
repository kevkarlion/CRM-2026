import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { TechnicalVisitModel } from '@/operations/models/technical-visit';
import { TechnicianModel } from '@/operations/models/technician';
import { WorkReportService } from '@/operations/services/work-report.service';
import { logActivity } from '@/audit/activity-logger';
import mongoose from 'mongoose';

const TARGET_STATUS = 'completed';

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
 * POST /api/operations/technical-visits/[id]/complete
 * 
 * Completes work execution on a TechnicalVisit.
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await connectDB();
    const { id: visitId } = await params;
    
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

    // Find the TechnicalVisit
    const visit = await TechnicalVisitModel.findOne({
      _id: new mongoose.Types.ObjectId(visitId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      deletedAt: null,
    }).session(session);

    if (!visit) {
      await session.abortTransaction();
      return NextResponse.json({ error: 'TechnicalVisit not found' }, { status: 404 });
    }

    // Check status is 'in_progress'
    if (visit.status !== 'in_progress') {
      await session.abortTransaction();
      return NextResponse.json(
        { error: `Work must be in progress to complete. Current status: ${visit.status}` },
        { status: 400 }
      );
    }

    // Get the assigned technician
    if (!visit.assignedTechnicianId) {
      await session.abortTransaction();
      return NextResponse.json({ error: 'No technician assigned to this visit' }, { status: 404 });
    }

    const technician = await TechnicianModel.findById(visit.assignedTechnicianId).session(session);
    
    if (!technician) {
      await session.abortTransaction();
      return NextResponse.json({ error: 'Assigned technician not found' }, { status: 404 });
    }

    // Verify the current user is the assigned technician (via userId)
    if (technician.userId?.toString() !== userId) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: 'Only the assigned technician can complete this work' },
        { status: 403 }
      );
    }

    const technicianId = technician._id;
    const now = new Date();
    
    // Get startedAt from the visit (should be Date now after schema fix)
    const startedAt = visit.startedAt instanceof Date ? visit.startedAt : 
                      visit.startedAt ? new Date(String(visit.startedAt)) : now;

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

    // Create WorkReport for TechnicalVisit
    const workReport = await workReportService.createForTechnicalVisit(
      visitId,
      workReportData,
      tenantId,
      userId
    );

    // Update TechnicalVisit status and set workReportId, finishedAt, duration
    await TechnicalVisitModel.findByIdAndUpdate(visitId, {
      $set: {
        status: TARGET_STATUS,
        finishedAt: now,
        completedAt: now,
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

    // Log activities (outside transaction - best effort)
    try {
      await logActivity({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        entityType: 'technicalVisit',
        entityId: new mongoose.Types.ObjectId(visitId),
        action: 'work_completed',
        actorId: new mongoose.Types.ObjectId(userId),
        metadata: {
          previousStatus: 'in_progress',
          newStatus: TARGET_STATUS,
          technicianId: technicianId.toString(),
          result: body.result,
          workReportId: workReport._id.toString(),
          duration,
        },
      });

      await logActivity({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        entityType: 'workReport',
        entityId: workReport._id,
        action: 'work_report_created',
        actorId: new mongoose.Types.ObjectId(userId),
        metadata: {
          technicalVisitId: visitId.toString(),
          technicianId: technicianId.toString(),
          result: body.result,
        },
      });
    } catch (logError) {
      console.error('[TechnicalVisit Complete] Failed to log activity:', logError);
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
        const { id: visitId } = await params;
        
        const visit = await TechnicalVisitModel.findOne({
          _id: new mongoose.Types.ObjectId(visitId),
          tenantId: new mongoose.Types.ObjectId(tenantId),
        });

        if (visit?.assignedTechnicianId) {
          await TechnicianModel.findByIdAndUpdate(visit.assignedTechnicianId, {
            $set: { availability: 'available' },
          });
        }
      }
    } catch (rollbackError) {
      console.error('[TechnicalVisit Complete] Rollback failed:', rollbackError);
    }

    await session.abortTransaction();
    
    console.error('[TechnicalVisit Complete] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}