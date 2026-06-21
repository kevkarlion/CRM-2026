import { NextRequest, NextResponse } from 'next/server';
import { LeadService, ConflictError } from '@/src/leads/services/lead.service';
import { TransitionError } from '@/src/leads/helpers/lead-state-machine';

const service = new LeadService();

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { status: targetStatus } = body;

    if (!targetStatus) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const updated = await service.changeStatus(params.id, targetStatus, userId, tenantId);

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TransitionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
