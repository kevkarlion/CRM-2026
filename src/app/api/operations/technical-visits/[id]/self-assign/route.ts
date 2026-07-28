import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { TechnicalVisitModel } from '@/operations/models/technical-visit';
import { TechnicianModel } from '@/operations/models/technician';
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

    // Check if already assigned
    if (visit.assignedTechnicianId) {
      return NextResponse.json(
        { error: 'Esta visita técnica ya está asignada a otro técnico' },
        { status: 400 },
      );
    }

    // Check if visit is in a valid status for assignment
    if (!['scheduled', 'confirmed', 'draft'].includes(visit.status)) {
      return NextResponse.json(
        { error: 'No se puede asignar esta visita técnica en su estado actual' },
        { status: 400 },
      );
    }

    // Update the visit with the technician
    visit.assignedTechnicianId = technician._id as Types.ObjectId;
    visit.status = 'confirmed';
    visit.updatedBy = userObjectId;
    await visit.save();

    return NextResponse.json({
      data: {
        _id: visit._id.toString(),
        visitNumber: visit.visitNumber,
        title: visit.title,
        status: visit.status,
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