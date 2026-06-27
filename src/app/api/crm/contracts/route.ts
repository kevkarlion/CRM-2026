import { NextRequest, NextResponse } from 'next/server';
import { ContractService, ContractValidationError } from '@/contracts/services';
import type { CreateContractInput } from '@/contracts/types/contract';

const service = new ContractService();

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const clientId = searchParams.get('clientId') || undefined;

    const contracts = await service.findByTenant(tenantId, { status: status as any, clientId });
    return NextResponse.json(contracts);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as CreateContractInput;
    const contract = await service.create(body, userId, tenantId);

    return NextResponse.json(contract, { status: 201 });
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
