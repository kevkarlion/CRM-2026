import { NextRequest, NextResponse } from 'next/server';
import { AssignmentService } from '@/src/operations/services/assignment.service';

const service = new AssignmentService();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || '';
    const userId = request.headers.get('x-user-id') || '';
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'x-tenant-id and x-user-id headers are required' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'action is required (assign, reassign, unassign)' }, { status: 400 });
    }

    switch (action) {
      case 'assign': {
        const { technicianId } = body;
        if (!technicianId) {
          return NextResponse.json({ error: 'technicianId is required for assign' }, { status: 400 });
        }
        const result = await service.assignTechnician(params.id, technicianId, tenantId, userId);
        return NextResponse.json({ data: result.assignment }, { status: 201 });
      }

      case 'reassign': {
        const { oldTechnicianId, newTechnicianId } = body;
        if (!oldTechnicianId || !newTechnicianId) {
          return NextResponse.json({ error: 'oldTechnicianId and newTechnicianId are required for reassign' }, { status: 400 });
        }
        const result = await service.reassignTechnician(params.id, oldTechnicianId, newTechnicianId, tenantId, userId);
        return NextResponse.json({ data: result.newAssignment });
      }

      case 'unassign': {
        const { technicianId } = body;
        if (!technicianId) {
          return NextResponse.json({ error: 'technicianId is required for unassign' }, { status: 400 });
        }
        const result = await service.unassignTechnician(params.id, technicianId, tenantId, userId);
        return NextResponse.json({ data: result.workOrder });
      }

      default:
        return NextResponse.json(
          { error: `Invalid action '${action}'. Use assign, reassign, or unassign.` },
          { status: 400 },
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      error instanceof Error && error.message.includes('already assigned') ? { status: 409 }
        : error instanceof Error && error.message.includes('not found') ? { status: 404 }
        : { status: 500 },
    );
  }
}
