import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import { TechnicalVisitModel } from '@/operations/models/technical-visit';
import { TechnicianModel } from '@/operations/models/technician';
import { logActivity } from '@/audit/activity-logger';
import mongoose from 'mongoose';

const VALID_STATUSES = ['scheduled', 'assigned'] as const;
const TARGET_STATUS = 'in_progress';

/**
 * POST /api/operations/technical-visits/[id]/start
 * 
 * Starts work execution on a TechnicalVisit.
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
    const { id: visitId } = await params;
    
    const tenantId = request.headers.get('x-tenant-id') || '';
    const userId = request.headers.get('x-user-id') || '';
    
    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'x-tenant-id and x-user-id headers are required' },
        { status: 400 }
      );
    }

    // Find the TechnicalVisit
    const visit = await TechnicalVisitModel.findOne({
      _id: new mongoose.Types.ObjectId(visitId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      deletedAt: null,
    });

    if (!visit) {
      return NextResponse.json({ error: 'TechnicalVisit not found' }, { status: 404 });
    }

    // Check status is 'scheduled' or 'assigned'
    if (!(VALID_STATUSES as readonly string[]).includes(visit.status)) {
      return NextResponse.json(
        { error: visit.status === 'in_progress' ? 'Work already in progress' : `Cannot start work from status: ${visit.status}` },
        { status: 400 }
      );
    }

    // Get the assigned technician
    if (!visit.assignedTechnicianId) {
      return NextResponse.json({ error: 'No technician assigned to this visit' }, { status: 404 });
    }

    const technician = await TechnicianModel.findById(visit.assignedTechnicianId);
    
    if (!technician) {
      return NextResponse.json({ error: 'Assigned technician not found' }, { status: 404 });
    }

    // Verify the current user is the assigned technician (via userId)
    if (technician.userId?.toString() !== userId) {
      return NextResponse.json(
        { error: 'Only the assigned technician can start this work' },
        { status: 403 }
      );
    }

    const technicianId = technician._id;
    const now = new Date();

    // Update TechnicalVisit status
    await TechnicalVisitModel.findByIdAndUpdate(visitId, {
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

    // Log activity
    const techName = technician ? 
      `${(technician as any).firstName || ''} ${(technician as any).lastName || ''}`.trim() || (technician as any).name || 'Técnico' 
      : 'Técnico';

    await logActivity({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      entityType: 'technicalVisit',
      entityId: new mongoose.Types.ObjectId(visitId),
      action: 'visit_started',
      actorId: new mongoose.Types.ObjectId(userId),
      metadata: {
        visitNumber: visit.visitNumber,
        title: visit.title,
        previousStatus: visit.status,
        newStatus: TARGET_STATUS,
        technicianId: technicianId.toString(),
        technicianName: techName,
        scheduledDate: visit.scheduledDate,
        category: visit.category,
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
    console.error('[TechnicalVisit Start] Error:', error);
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}