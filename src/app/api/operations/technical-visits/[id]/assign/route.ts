import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { technicalVisitService } from '@/operations/services/technical-visit.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id') || '';
    const userId = request.headers.get('x-user-id') || '';
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'x-tenant-id and x-user-id headers are required' }, { status: 400 });
    }

    const body = await request.json() as { action: string; technicianId?: string };
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'action is required (assign, reassign, unassign)' }, { status: 400 });
    }

    switch (action) {
      case 'assign':
      case 'reassign': {
        const { technicianId } = body;
        if (!technicianId) {
          return NextResponse.json({ error: 'technicianId is required' }, { status: 400 });
        }
        const visit = await technicalVisitService.assignTechnician(id, technicianId, tenantId, userId);
        return NextResponse.json({ data: visit });
      }

      case 'unassign': {
        const visit = await technicalVisitService.unassignTechnician(id, tenantId, userId);
        return NextResponse.json({ data: visit });
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
      error instanceof Error && error.message.includes('not found') ? { status: 404 }
        : { status: 500 },
    );
  }
}
