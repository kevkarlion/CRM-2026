import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { WorkOrderService, ValidationError } from '@/operations/services/work-order.service';
import type { CreateWorkOrderInput } from '@/operations/types/work-order';

const service = new WorkOrderService();

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const status = searchParams.get('status') || undefined;
    const type = searchParams.get('type') || undefined;
    const technicianId = searchParams.get('technicianId') || undefined;
    const clientId = searchParams.get('clientId') || undefined;
    const leadId = searchParams.get('leadId') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const search = searchParams.get('search') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const expired = searchParams.get('expired') || undefined;
    const workStatus = searchParams.get('workStatus') || undefined;

    const filters: Record<string, unknown> = {};
    if (status) filters.status = status;
    if (expired === 'true') {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      // Last 30 days
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
      
      filters.scheduledDateGte = thirtyDaysAgoStr;
      filters.scheduledDateLt = todayStr;
      filters.statusNin = ['completed', 'cancelled', 'closed'];
      filters.workStatus = { $nin: ['paused', 'cancelled'] };
    }
    if (type === 'technical_visit') {
      filters.source = 'technical_visit';
    } else if (type === 'work_order') {
      filters.source = { $in: ['lead_conversion', 'maintenance_contract', 'direct_sale', 'manual'] };
    }
    if (technicianId) filters.technicianId = technicianId;
    if (clientId) filters.clientId = clientId;
    if (leadId) filters.leadId = leadId;
    if (from || to) {
      filters.scheduledDateGte = from || undefined;
      filters.scheduledDateLte = to || undefined;
    }
    if (search) filters.search = search;
    if (priority) filters.priority = priority;
    if (workStatus) filters.workStatus = workStatus;

    const data = await service.findByTenant(tenantId, filters as any);

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id') || '';
    const userId = request.headers.get('x-user-id') || '';
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'x-tenant-id and x-user-id headers are required' }, { status: 400 });
    }

    const body = await request.json() as CreateWorkOrderInput;
    const data = await service.create(body, tenantId, userId);

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    // CastError = mongoose error por ID inválido
    if ((error as any).name === 'CastError') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
