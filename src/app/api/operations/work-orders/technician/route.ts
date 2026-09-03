import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
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
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const search = searchParams.get('search') || undefined;
    const workStatus = searchParams.get('workStatus') || undefined;
    const expired = searchParams.get('expired');

    // Calcular "hoy" en timezone Argentina (UTC-3)
    const now = new Date();
    const argentinaOffset = -3 * 60;
    const localNow = new Date(now.getTime() + (now.getTimezoneOffset() + argentinaOffset) * 60000);
    const todayStr = localNow.toISOString().split('T')[0];

    const dateFilter: Record<string, unknown> = {};
    if (startDateParam) {
      dateFilter.$gte = startDateParam;
    }
    if (endDateParam) {
      dateFilter.$lte = endDateParam;
    }

    // BASE QUERY: solo órdenes del técnico, activas (no draft/closed/cancelled, no vencidas)
    const query: Record<string, unknown> = {
      tenantId: tenantObjectId,
      assignedTechnicians: technician._id,
      deletedAt: null,
      // SIEMPRE excluir draft, closed, cancelled
      status: { $nin: ['draft', 'closed', 'cancelled'] },
      // SIEMPRE excluir vencidas
      $and: [
        {
          $or: [
            { scheduledDate: { $exists: false } },
            { scheduledDate: null },
            { scheduledDate: { $gte: todayStr } },
            { status: 'in_progress' },
          ],
        },
        {
          $or: [
            { workStatus: { $exists: false } },
            { workStatus: null },
            { workStatus: 'active' },
          ],
        },
      ],
    };

    // Support multiple statuses separated by comma (e.g., "scheduled,assigned,confirmed")
    if (status) {
      const statusList = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statusList.length === 1) {
        query.status = statusList[0];
      } else if (statusList.length > 1) {
        query.status = { $in: statusList };
      }
    }

    // Support expired filter (scheduledDate <= today, last 30 days, excluding today)
    if (expired === 'true') {
      // Last 30 days but BEFORE today
      const thirtyDaysAgo = new Date(localNow);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      query.scheduledDate = { $gte: thirtyDaysAgoStr, $lt: todayStr };
      // Allow showing completed/cancelled for expired view
      delete query.status;
    }

    if (priority) {
      query.priority = priority;
    }

    // Filter by workStatus (negocio)
    if (workStatus) {
      // Remove the workStatus $or from $and when filtering by specific workStatus
      query.workStatus = workStatus;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: searchRegex },
          { 'clientSnapshot.name': searchRegex },
        ],
      });
    }

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
      source: wo.source,
      scheduledDate: wo.scheduledDate,
      scheduledStart: wo.scheduledStart,
      scheduledEnd: wo.scheduledEnd,
      clientSnapshot: wo.clientSnapshot,
      locationSnapshot: wo.locationSnapshot,
      assignedTechnicians: wo.assignedTechnicians?.map((t: any) => ({
        _id: String(t._id),
        name: t.name,
        email: t.email,
        phone: t.phone,
      })) || [],
    }));

    return NextResponse.json({ data: events, technicianId: String(technician._id) });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 },
    );
  }
}
