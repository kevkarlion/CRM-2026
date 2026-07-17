import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { workAssignmentService } from '@/operations/services/work-assignment.service';
import { ValidationError } from '@/core/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const history = searchParams.get('history') === 'true';

    if (history) {
      const assignments = await workAssignmentService.getAssignmentHistory(id, tenantId);
      return NextResponse.json(assignments);
    }

    const current = await workAssignmentService.getCurrentAssignment(id, tenantId);
    return NextResponse.json(current || { message: 'No active assignment' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    const { technicianId, assignmentType, reason, reasonDetail, notes } = body;

    if (!technicianId) {
      return NextResponse.json({ error: 'technicianId is required' }, { status: 400 });
    }

    if (!assignmentType) {
      return NextResponse.json({ error: 'assignmentType is required' }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 });
    }

    const assignment = await workAssignmentService.createAssignment(
      workOrderId,
      technicianId,
      userId,
      tenantId,
      {
        assignmentType,
        reason,
        reasonDetail,
        notes,
      }
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