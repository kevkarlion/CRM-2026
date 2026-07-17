import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { FollowUpService } from '@/negotiation/services/follow-up.service';

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
    const { nextContactDate, assignedTo, priority, internalNotes } = body;

    const negotiation = await new FollowUpService().updateFollowUp(
      id,
      { nextContactDate, assignedTo, priority, internalNotes },
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
