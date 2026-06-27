import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { DashboardCommercialService } from '@/dashboard/services/dashboard-commercial.service';

const service = new DashboardCommercialService();

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    await connectDB();
    const metrics = await service.getCommercialMetrics(tenantId);
    return NextResponse.json(metrics);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
