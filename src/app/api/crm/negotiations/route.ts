import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { NegotiationService, TransitionError, NotFoundError } from '@/negotiation/services/negotiation.service';
import type { NegotiationStatus } from '@/negotiation/types/negotiation';

const service = new NegotiationService();

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as NegotiationStatus | undefined;
    const leadId = searchParams.get('leadId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const negotiations = await service.findByTenant(tenantId, { status, leadId, limit });

    return NextResponse.json(negotiations);
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
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const negotiation = await service.create(body, userId, tenantId);

    return NextResponse.json(negotiation, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
