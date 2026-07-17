import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { TechnicianModel } from '@/operations/schemas/technician';
import { Types } from 'mongoose';

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
    const technician = await TechnicianModel.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    }).lean();

    if (!technician) {
      return NextResponse.json({ error: 'Technician not found' }, { status: 404 });
    }

    return NextResponse.json({
      _id: String(technician._id),
      name: technician.name,
      email: technician.email,
      phone: technician.phone,
      specialties: technician.specialties,
      zones: technician.zones,
      status: technician.status,
      availability: technician.availability,
      maxDailyWorkOrders: technician.maxDailyWorkOrders,
      userId: technician.userId ? String(technician.userId) : null,
      createdAt: technician.createdAt,
      updatedAt: technician.updatedAt,
    });
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
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updatedBy: new Types.ObjectId(userId),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.specialties !== undefined) updateData.specialties = body.specialties;
    if (body.zones !== undefined) updateData.zones = body.zones;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.availability !== undefined) updateData.availability = body.availability;
    if (body.maxDailyWorkOrders !== undefined) updateData.maxDailyWorkOrders = body.maxDailyWorkOrders;
    if (body.userId !== undefined) {
      updateData.userId = body.userId ? new Types.ObjectId(body.userId) : null;
    }

    const technician = await TechnicianModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      },
      { $set: updateData },
      { new: true }
    );

    if (!technician) {
      return NextResponse.json({ error: 'Technician not found' }, { status: 404 });
    }

    return NextResponse.json({ _id: String(technician._id), name: technician.name });
  } catch (error) {
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
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const technician = await TechnicianModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: new Types.ObjectId(userId),
          status: 'inactive',
        },
      },
      { new: true }
    );

    if (!technician) {
      return NextResponse.json({ error: 'Technician not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}