import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { WorkOrderModel, WorkReportModel } from '@/operations/models';
import mongoose from 'mongoose';

/**
 * GET /api/operations/work-orders/recent-reports
 * 
 * Returns the last 5 work reports completed in the last hour for the current tenant.
 * Used by the admin toast notification system.
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const tenantId = request.headers.get('x-tenant-id') || '';
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-tenant-id header is required' },
        { status: 400 }
      );
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Find work orders completed in the last hour that have a workReportId
    const recentWorkOrders = await WorkOrderModel.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      status: 'closed',
      closedAt: { $gte: oneHourAgo },
      workReportId: { $ne: null },
      deletedAt: null,
    })
      .sort({ closedAt: -1 })
      .limit(5)
      .lean();

    // If no work orders found, return empty array
    if (!recentWorkOrders.length) {
      return NextResponse.json({ reports: [] });
    }

    // Get work report details for each work order
    const workReportIds = recentWorkOrders
      .filter((wo) => wo.workReportId)
      .map((wo) => wo.workReportId);

    const workReports = await WorkReportModel.find({
      _id: { $in: workReportIds },
    })
      .populate('technicianId', 'firstName lastName name')
      .lean();

    const reportsMap = new Map(
      workReports.map((wr) => [wr._id.toString(), wr])
    );

    // Build response with technician info
    const reports = recentWorkOrders
      .filter((wo) => wo.workReportId && reportsMap.has(wo.workReportId.toString()))
      .map((wo) => {
        const workReport = reportsMap.get(wo.workReportId!.toString()) as any;
        const tech = workReport?.technicianId as any;
        
        return {
          workOrderId: wo._id.toString(),
          workOrderNumber: wo.workOrderNumber,
          workReportId: wo.workReportId?.toString(),
          clientId: wo.clientId?.toString(),
          title: wo.title,
          closedAt: wo.closedAt,
          technicianName: tech 
            ? `${tech.firstName || ''} ${tech.lastName || ''}`.trim() || tech.name || 'Técnico'
            : 'Técnico',
          technicianId: workReport?.technicianId?.toString(),
        };
      });

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('[Recent Reports] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
