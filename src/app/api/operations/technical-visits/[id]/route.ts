import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { TechnicalVisitService, technicalVisitService } from '@/operations/services/technical-visit.service';
import { ValidationError } from '@/core/errors';
import { Types } from 'mongoose';

const service = new TechnicalVisitService();

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
    const visit = await service.findById(id, tenantId);

    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    return NextResponse.json({ data: visit });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id') || '';
    const userId = request.headers.get('x-user-id') || '';

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json() as {
      assignedTechnicianId?: string | null;
      [key: string]: unknown;
    };

    // `assignedTechnicianId` is a denormalized field owned exclusively by the
    // technical visit service — never write it through the generic update path.
    const { assignedTechnicianId, ...data } = body;

    const visit = await service.update(id, data, tenantId, userId);

    if (!visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    // Technician changes are assignment operations: route them through the
    // technical visit service (assign/unassign) so the denormalized field is
    // only ever written there.
    if (assignedTechnicianId !== undefined) {
      if (assignedTechnicianId === null) {
        await technicalVisitService.unassignTechnician(id, tenantId, userId);
      } else {
        const techId = String(assignedTechnicianId);
        if (!Types.ObjectId.isValid(techId)) {
          return NextResponse.json({ error: 'Invalid technician id' }, { status: 422 });
        }
        await technicalVisitService.assignTechnician(id, techId, tenantId, userId);
      }
    }

    const refreshed = await service.findById(id, tenantId);
    return NextResponse.json({ data: refreshed });
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

export async function DELETE(
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
    const deleted = await service.delete(id, tenantId);

    if (!deleted) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}