import { NextRequest, NextResponse } from 'next/server';
import { ContractService, ContractValidationError } from '@/contracts/services';

const service = new ContractService();

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; equipmentId: string } },
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await service.removeEquipment(params.id, params.equipmentId, tenantId);

    return NextResponse.json({ message: 'Equipment removed' });
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
