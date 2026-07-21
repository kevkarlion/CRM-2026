import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import WorkOrderModel from '@/operations/models/work-order';
import { TechnicianModel } from '@/operations/models/technician';
import { Types } from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'x-tenant-id and x-user-id headers are required' },
        { status: 401 },
      );
    }

    const tenantObjectId = new Types.ObjectId(tenantId);
    const userObjectId = new Types.ObjectId(userId);

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

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const dateFilter: Record<string, unknown> = {};
    if (startDateParam) {
      dateFilter.$gte = new Date(startDateParam);
    }
    if (endDateParam) {
      dateFilter.$lte = new Date(endDateParam);
    }

    const query: Record<string, unknown> = {
      tenantId: tenantObjectId,
      assignedTechnicians: technician._id,
      deletedAt: null,
    };

    if (Object.keys(dateFilter).length > 0) {
      query.scheduledDate = dateFilter;
    }

    const workOrders = await WorkOrderModel.find(query)
      .populate('assignedTechnicians', 'name email phone')
      .sort({ scheduledDate: 1, scheduledStart: 1 })
      .lean();

    const events = workOrders.map((wo) => ({
      _id: String(wo._id),
      workOrderNumber: wo.workOrderNumber,
      title: wo.title,
      status: wo.status,
      priority: wo.priority,
      category: wo.category,
      scheduledDate: wo.scheduledDate,
      scheduledStart: wo.scheduledStart,
      scheduledEnd: wo.scheduledEnd,
      clientSnapshot: wo.clientSnapshot,
      locationSnapshot: wo.locationSnapshot,
      technicians: wo.assignedTechnicians?.map((t: any) => ({
        _id: String(t._id),
        name: t.name,
        email: t.email,
        phone: t.phone,
      })) || [],
    }));

    return NextResponse.json({ data: events, technicianId: String(technician._id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
