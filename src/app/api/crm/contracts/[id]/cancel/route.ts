import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { ContractService, ContractValidationError } from '@/contracts/services';
import { MaintenanceSchedulerService } from '@/contracts/services/maintenance-scheduler.service';

const contractService = new ContractService();
const schedulerService = new MaintenanceSchedulerService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contract = await contractService.changeStatus(id, 'cancelled', tenantId, userId);
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Cancel future schedules
    const cancelledSchedules = await schedulerService.cancelFutureSchedules(id, tenantId, userId);

    return NextResponse.json({ ...contract, cancelledSchedules }, { status: 200 });
  } catch (error) {
    if (error instanceof ContractValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
