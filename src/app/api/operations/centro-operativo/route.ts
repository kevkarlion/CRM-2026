import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { operativeDashboardService } from '@/operations/services/operative-dashboard.service';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-tenant-id header is required' },
        { status: 401 },
      );
    }

    const [dashboardMetrics, technicianWorkload] = await Promise.all([
      operativeDashboardService.getDashboardMetrics(tenantId),
      operativeDashboardService.getTechnicianWorkload(tenantId),
    ]);

    return NextResponse.json({
      summary: dashboardMetrics.summary,
      byStatus: dashboardMetrics.byStatus,
      byPriority: dashboardMetrics.byPriority,
      technicians: technicianWorkload,
      nextActions: dashboardMetrics.nextActions,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
