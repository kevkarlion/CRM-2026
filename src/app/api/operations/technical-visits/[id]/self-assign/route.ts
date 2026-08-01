import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { TechnicalVisitModel } from '@/operations/models/technical-visit';
import { TechnicianModel } from '@/operations/models/technician';
import { technicalVisitService } from '@/operations/services/technical-visit.service';
import { Types } from 'mongoose';

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
      return NextResponse.json(
        { error: 'x-tenant-id and x-user-id headers are required' },
        { status: 400 },
      );
    }

    const body = await request.json() as {
      reason: string;
      observations?: string;
    };

    if (!body.reason) {
      return NextResponse.json(
        { error: 'reason is required' },
        { status: 400 },
      );
    }

    const tenantObjectId = new Types.ObjectId(tenantId);
    const userObjectId = new Types.ObjectId(userId);

    // Find technician by userId
    const technician = await TechnicianModel.findOne({
      userId: userObjectId,
      tenantId: tenantObjectId,
      deletedAt: null,
    }).lean();

    if (!technician) {
      return NextResponse.json(
        { error: 'No se encontró un técnico asociado a este usuario' },
        { status: 404 },
      );
    }

    // Find the technical visit
    const visit = await TechnicalVisitModel.findOne({
      _id: new Types.ObjectId(id),
      tenantId: tenantObjectId,
      deletedAt: null,
    });

    if (!visit) {
      return NextResponse.json(
        { error: 'Visita técnica no encontrada' },
        { status: 404 },
      );
    }

    // Check if visit is in a valid status for assignment
    // Allow from scheduled, confirmed, or assigned (can take from another technician)
    if (!['scheduled', 'confirmed', 'assigned'].includes(visit.status)) {
      return NextResponse.json(
        { error: 'No se puede asignar esta visita técnica en su estado actual' },
        { status: 400 },
      );
    }

    // Assign via the technical visit service - handles both new assignment and takeover
    const assignedVisit = await technicalVisitService.assignTechnician(
      id,
      String(technician._id),
      tenantId,
      userId,
    );

    return NextResponse.json({
      data: {
        _id: visit._id.toString(),
        visitNumber: assignedVisit?.visitNumber || visit.visitNumber,
        title: assignedVisit?.title || visit.title,
        status: assignedVisit?.status || 'assigned',
        assignedTechnicianId: technician._id.toString(),
        technicianName: technician.name,
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}