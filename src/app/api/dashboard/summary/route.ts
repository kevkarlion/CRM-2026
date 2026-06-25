import { NextRequest, NextResponse } from 'next/server';
import { DashboardMetricsService } from '@/dashboard/services/dashboard-metrics.service';

const service = new DashboardMetricsService();

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const summary = await service.getSummary(tenantId);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
