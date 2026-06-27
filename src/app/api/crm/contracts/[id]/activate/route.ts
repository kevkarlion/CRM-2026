import { NextRequest, NextResponse } from 'next/server';
import { ContractService, ContractValidationError } from '@/contracts/services';
import { MaintenancePlanService } from '@/contracts/services/maintenance-plan.service';

const contractService = new ContractService();
const planService = new MaintenancePlanService();

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

    const contract = await contractService.changeStatus(params.id, 'active', tenantId, userId);
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Auto-generate schedules from active maintenance plans
    try {
      const schedulesCreated = await planService.generateSchedules(params.id, tenantId, userId);
      return NextResponse.json({ ...contract, schedulesCreated }, { status: 200 });
    } catch {
      // Schedules are best-effort on activation
      return NextResponse.json({ ...contract, schedulesCreated: 0 }, { status: 200 });
    }
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
