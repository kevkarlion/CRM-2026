import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { TechnicalVisitModel } from '@/operations/models/technical-visit';
import { WorkReportService } from '@/operations/services/work-report.service';
import mongoose from 'mongoose';

/**
 * GET /api/operations/technical-visits/[id]/work-report
 * 
 * Retrieves the WorkReport associated with a TechnicalVisit.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: visitId } = await params;
    
    const tenantId = request.headers.get('x-tenant-id') || '';
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-tenant-id header is required' },
        { status: 400 }
      );
    }

    // Verify TechnicalVisit exists
    const visit = await TechnicalVisitModel.findOne({
      _id: new mongoose.Types.ObjectId(visitId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      deletedAt: null,
    });

    if (!visit) {
      return NextResponse.json({ error: 'TechnicalVisit not found' }, { status: 404 });
    }

    // Get WorkReport by technicalVisitId
    const workReportService = new WorkReportService();
    const workReport = await workReportService.getByTechnicalVisitId(visitId, tenantId);

    if (!workReport) {
      return NextResponse.json(
        { error: 'WorkReport not found for this TechnicalVisit' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: workReport,
    });
  } catch (error) {
    console.error('[TechnicalVisit WorkReport GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}