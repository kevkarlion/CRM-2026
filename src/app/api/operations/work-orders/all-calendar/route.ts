import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import WorkOrderModel from '@/operations/models/work-order';
import { TechnicalVisitModel } from '@/operations/models/technical-visit';
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

    console.log('[all-calendar] Fetching all work orders and visits for tenant:', tenantId);

    // Get ALL work orders (no date filter by default)
    const workOrders = await WorkOrderModel.find({
      tenantId: tenantObjectId,
      deletedAt: null,
    })
      .populate('assignedTechnicians', 'name email phone')
      .sort({ scheduledDate: 1, scheduledStart: 1 })
      .limit(200)
      .lean();

    console.log('[all-calendar] Found work orders:', workOrders.length);

    // Get ALL technical visits
    const visits = await TechnicalVisitModel.find({
      tenantId: tenantObjectId,
      deletedAt: null,
    })
      .populate('assignedTechnicianId', 'name email phone')
      .sort({ scheduledDate: 1, scheduledStart: 1 })
      .limit(200)
      .lean();

    console.log('[all-calendar] Found visits:', visits.length);

    // Map Work Orders to calendar events
    const workOrderEvents = workOrders.map((wo) => ({
      _id: String(wo._id),
      type: 'work_order' as const,
      workOrderNumber: wo.workOrderNumber,
      title: wo.title,
      status: wo.status,
      priority: wo.priority,
      category: wo.category,
      scheduledDate: typeof wo.scheduledDate === 'string' ? wo.scheduledDate : wo.scheduledDate?.toISOString().split('T')[0],
      scheduledStart: wo.scheduledStart?.toISOString(),
      scheduledEnd: wo.scheduledEnd?.toISOString(),
      clientSnapshot: wo.clientSnapshot,
      locationSnapshot: wo.locationSnapshot,
      technicians: wo.assignedTechnicians?.map((t: any) => ({
        _id: String(t._id),
        name: t.name,
        email: t.email,
        phone: t.phone,
      })) || [],
      isAssigned: (wo.assignedTechnicians || []).length > 0,
    }));

    // Map Technical Visits to calendar events
    const visitEvents = visits.map((tv) => ({
      _id: String(tv._id),
      type: 'technical_visit' as const,
      visitNumber: tv.visitNumber,
      title: tv.title,
      status: tv.status,
      priority: tv.priority,
      category: tv.category,
      scheduledDate: tv.scheduledDate ? (typeof tv.scheduledDate === 'string' ? tv.scheduledDate : tv.scheduledDate.toISOString().split('T')[0]) : undefined,
      scheduledStart: tv.scheduledStart?.toISOString(),
      scheduledEnd: tv.scheduledEnd?.toISOString(),
      clientSnapshot: tv.clientSnapshot,
      locationSnapshot: tv.locationSnapshot,
      technician: tv.assignedTechnicianId ? {
        _id: String((tv.assignedTechnicianId as any)._id),
        name: (tv.assignedTechnicianId as any).name,
        email: (tv.assignedTechnicianId as any).email,
        phone: (tv.assignedTechnicianId as any).phone,
      } : null,
      isAssigned: !!tv.assignedTechnicianId,
    }));

    // Combine and sort by date
    const allEvents = [...workOrderEvents, ...visitEvents].sort((a, b) => {
      const dateA = a.scheduledDate || '';
      const dateB = b.scheduledDate || '';
      return dateA.localeCompare(dateB);
    });

    console.log('[all-calendar] Total events:', allEvents.length);

    return NextResponse.json({ 
      data: allEvents, 
      total: allEvents.length,
    });
  } catch (error) {
    console.error('[all-calendar] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}