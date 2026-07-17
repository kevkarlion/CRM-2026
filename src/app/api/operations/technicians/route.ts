import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { TechnicianModel } from '@/operations/schemas/technician';
import { Types } from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const availability = searchParams.get('availability');
    const specialty = searchParams.get('specialty');

    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    };

    if (status) filter.status = status;
    if (availability) filter.availability = availability;
    if (specialty) filter.specialties = specialty;

    const technicians = await TechnicianModel.find(filter)
      .sort({ name: 1 })
      .lean();

    const formatted = technicians.map((t) => ({
      _id: String(t._id),
      name: t.name,
      email: t.email,
      phone: t.phone,
      specialties: t.specialties,
      zones: t.zones,
      status: t.status,
      availability: t.availability,
      maxDailyWorkOrders: t.maxDailyWorkOrders,
      hasUser: !!t.userId,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, phone, specialties, zones, maxDailyWorkOrders, userId: linkedUserId } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const technician = await TechnicianModel.create({
      tenantId: new Types.ObjectId(tenantId),
      name,
      email,
      phone,
      specialties: specialties || [],
      zones: zones || [],
      maxDailyWorkOrders: maxDailyWorkOrders || 5,
      userId: linkedUserId ? new Types.ObjectId(linkedUserId) : null,
      status: 'active',
      availability: 'available',
      createdBy: new Types.ObjectId(userId),
      updatedBy: new Types.ObjectId(userId),
    });

    return NextResponse.json(
      { _id: String(technician._id), name: technician.name },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}