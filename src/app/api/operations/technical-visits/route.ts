import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { TechnicalVisitService } from '@/operations/services/technical-visit.service';
import { ValidationError } from '@/core/errors';

const service = new TechnicalVisitService();

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const leadId = searchParams.get('leadId') || undefined;
    const search = searchParams.get('search') || undefined;
    const technicianId = searchParams.get('technicianId') || undefined;
    const clientId = searchParams.get('clientId') || undefined;
    const expired = searchParams.get('expired') || undefined;

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
      filters.statusNin = ['completed', 'cancelled', 'closed', 'paused'];
    }
    if (priority) filters.priority = priority;
    if (leadId) filters.leadId = leadId;
    if (search) filters.search = search;
    if (technicianId) filters.technicianId = technicianId;
    if (clientId) filters.clientId = clientId;
    if (from || to) {
      filters.scheduledDateGte = from ? new Date(from) : undefined;
      filters.scheduledDateLte = to ? new Date(to) : undefined;
    }

    const data = await service.findByTenant(tenantId, filters);
    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    // CastError = mongoose error por ID inválido
    if ((error as any).name === 'CastError') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id') || '';
    const userId = request.headers.get('x-user-id') || '';
    
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const visit = await service.create(body, tenantId, userId);

    return NextResponse.json({ data: visit }, { status: 201 });
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
      { status: 500 }
    );
  }
}