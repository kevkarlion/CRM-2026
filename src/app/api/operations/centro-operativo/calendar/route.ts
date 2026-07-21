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

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const technicianId = searchParams.get('technicianId');

    const startDate = startDateParam ? new Date(startDateParam) : new Date();
    const endDate = endDateParam
      ? new Date(endDateParam)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    let agenda = await operativeDashboardService.getAgenda(
      tenantId,
      startDate,
      endDate,
    );

    if (technicianId) {
      agenda = agenda.filter((item) =>
        item.technicians.some((t) => t._id === technicianId),
      );
    }

    return NextResponse.json(agenda);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
