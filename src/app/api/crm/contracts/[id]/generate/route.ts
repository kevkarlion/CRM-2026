import { NextRequest, NextResponse } from 'next/server';
import { MaintenanceSchedulerService } from '@/contracts/services/maintenance-scheduler.service';

const service = new MaintenanceSchedulerService();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await service.generateWorkOrders(params.id, tenantId, userId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
