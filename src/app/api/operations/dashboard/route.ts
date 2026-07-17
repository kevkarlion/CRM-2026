import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { operativeDashboardService } from '@/operations/services/operative-dashboard.service';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'dashboard';

    if (view === 'technicians') {
      const workload = await operativeDashboardService.getTechnicianWorkload(tenantId);
      return NextResponse.json(workload);
    }

    if (view === 'agenda') {
      const startDateParam = searchParams.get('startDate');
      const endDateParam = searchParams.get('endDate');
      
      const startDate = startDateParam ? new Date(startDateParam) : new Date();
      const endDate = endDateParam ? new Date(endDateParam) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      const agenda = await operativeDashboardService.getAgenda(tenantId, startDate, endDate);
      return NextResponse.json(agenda);
    }

    // Default: dashboard metrics
    const metrics = await operativeDashboardService.getDashboardMetrics(tenantId);
    return NextResponse.json(metrics);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}