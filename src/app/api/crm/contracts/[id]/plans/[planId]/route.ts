import { NextRequest, NextResponse } from 'next/server';
import { MaintenancePlanService } from '@/src/contracts/services/maintenance-plan.service';

const service = new MaintenancePlanService();

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; planId: string } },
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const plan = await service.update(params.planId, body, tenantId, userId);

    if (!plan) {
      return NextResponse.json({ error: 'Maintenance plan not found' }, { status: 404 });
    }

    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
