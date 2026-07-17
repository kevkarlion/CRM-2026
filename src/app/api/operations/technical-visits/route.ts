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

    const filters: Record<string, unknown> = {};
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (leadId) filters.leadId = leadId;
    if (from || to) {
      filters.scheduledDateGte = from ? new Date(from) : undefined;
      filters.scheduledDateLte = to ? new Date(to) : undefined;
    }

    const data = await service.findByTenant(tenantId, filters);
    return NextResponse.json({ data, total: data.length });
  } catch (error) {
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}