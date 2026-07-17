import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { workAssignmentService } from '@/operations/services/work-assignment.service';
import { ValidationError } from '@/core/errors';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workOrderId } = await params;
    const body = await request.json();
    const { newTechnicianId, reason, reasonDetail, notes } = body;

    if (!newTechnicianId) {
      return NextResponse.json({ error: 'newTechnicianId is required' }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 });
    }

    const assignment = await workAssignmentService.replaceTechnician(
      workOrderId,
      newTechnicianId,
      userId,
      tenantId,
      reason,
      reasonDetail,
      notes
    );

    return NextResponse.json(assignment, { status: 201 });
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