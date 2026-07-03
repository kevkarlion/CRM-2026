import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { LeadService } from '@/leads/services/lead.service';

const service = new LeadService();

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    const rolesHeader = request.headers.get('x-user-roles');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = rolesHeader?.split(',')[0]?.trim() || 'comercial';

    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get('pipelineId');
    if (!pipelineId) {
      return NextResponse.json({ error: 'pipelineId is required' }, { status: 400 });
    }

    const filters = {
      assignedTo: searchParams.get('assignedTo') || undefined,
      search: searchParams.get('search') || undefined,
      createdAtGte: searchParams.get('createdAtGte') || undefined,
      createdAtLte: searchParams.get('createdAtLte') || undefined,
    };

    const result = await service.getLeadsGroupedByStage(
      pipelineId, tenantId, userId, role, filters
    );

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
