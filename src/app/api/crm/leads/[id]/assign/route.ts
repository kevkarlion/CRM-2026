import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { LeadAssignmentService } from '@/leads/services/lead-assignment.service';

const service = new LeadAssignmentService();

export async function POST(
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

    const body = await request.json() as { userId: string; reason?: string };
    const { userId: targetUserId, reason } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const result = await service.assign(id, targetUserId, userId, tenantId, reason);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
