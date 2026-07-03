import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { MaintenancePlanService } from '@/contracts/services/maintenance-plan.service';
import type { UpdateMaintenancePlanInput } from '@/contracts/types/maintenance-plan';

const service = new MaintenancePlanService();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> },
) {
  try {
    await connectDB();
    const { planId } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as UpdateMaintenancePlanInput;
    const plan = await service.update(planId, body, tenantId, userId);

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
