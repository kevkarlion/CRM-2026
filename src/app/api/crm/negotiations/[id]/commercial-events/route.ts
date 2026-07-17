import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { CommercialEventService } from '@/negotiation/services/commercial-event.service';

export async function PUT(
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

    const body = await request.json();
    const { eventType, description, createActivity } = body;

    if (!eventType || !description) {
      return NextResponse.json(
        { error: 'eventType and description are required' },
        { status: 400 },
      );
    }

    const negotiation = await new CommercialEventService().addEvent(
      id,
      { eventType, description, createActivity },
      userId,
      tenantId,
    );

    return NextResponse.json(negotiation);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
