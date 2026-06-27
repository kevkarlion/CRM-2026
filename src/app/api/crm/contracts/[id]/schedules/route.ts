import { NextRequest, NextResponse } from 'next/server';
import { MaintenanceScheduleModel } from '@/contracts/models';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    const filter: Record<string, unknown> = {
      tenantId,
      contractId: params.id,
    };

    if (status) {
      filter.status = status;
    }

    const schedules = await MaintenanceScheduleModel.find(filter)
      .sort({ scheduledDate: 1 })
      .populate('maintenancePlanId')
      
      .exec();

    return NextResponse.json(schedules);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
