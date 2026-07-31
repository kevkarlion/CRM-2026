import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { WorkOrderModel } from '@/operations/models';
import { WorkReportService } from '@/operations/services/work-report.service';
import mongoose from 'mongoose';

/**
 * GET /api/operations/work-orders/[id]/work-report
 * 
 * Retrieves the WorkReport associated with a WorkOrder.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: workOrderId } = await params;
    
    const tenantId = request.headers.get('x-tenant-id') || '';
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-tenant-id header is required' },
        { status: 400 }
      );
    }

    // Verify WorkOrder exists
    const workOrder = await WorkOrderModel.findOne({
      _id: new mongoose.Types.ObjectId(workOrderId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      deletedAt: null,
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'WorkOrder not found' }, { status: 404 });
    }

    // Get WorkReport by workOrderId
    const workReportService = new WorkReportService();
    const workReport = await workReportService.getByWorkOrderId(workOrderId, tenantId);

    if (!workReport) {
      return NextResponse.json(
        { error: 'WorkReport not found for this WorkOrder' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: workReport,
    });
  } catch (error) {
    console.error('[WorkOrder WorkReport GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}