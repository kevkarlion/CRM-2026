import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import WorkOrderModel from '@/operations/models/work-order';
import { TechnicalVisitModel } from '@/operations/models/technical-visit';
import { TechnicianModel } from '@/operations/models/technician';
import { Types } from 'mongoose';

// Set timezone to Chile for consistent date handling
process.env.TZ = 'America/Santiago';

/**
 * Convert a Date to YYYY-MM-DD string using Chile timezone (not UTC).
 * This prevents the day-shift bug when the server is in UTC.
 */
function toLocalDateString(date: Date | string | undefined): string | undefined {
  if (!date) return undefined;
  if (typeof date === 'string') return date;
  
  // Create date in Chile timezone
  const chileTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  const year = chileTime.getFullYear();
  const month = String(chileTime.getMonth() + 1).padStart(2, '0');
  const day = String(chileTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
    // Note: scheduledDate is stored as String "YYYY-MM-DD" in WorkOrder schema (may have legacy Date values)
    const workOrderEvents = workOrders.map((wo) => ({
      _id: String(wo._id),
      type: 'work_order' as const,
      workOrderNumber: wo.workOrderNumber,
      title: wo.title,
      status: wo.status,
      priority: wo.priority,
      category: wo.category,
      scheduledDate: toLocalDateString(wo.scheduledDate as any),
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
    // Note: scheduledDate is Date in TechnicalVisit schema - convert to local YYYY-MM-DD
    const visitEvents = visits.map((tv) => ({
      _id: String(tv._id),
      type: 'technical_visit' as const,
      visitNumber: tv.visitNumber,
      title: tv.title,
      status: tv.status,
      priority: tv.priority,
      category: tv.category,
      scheduledDate: toLocalDateString(tv.scheduledDate as any),
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

    // Get current technician ID if user is a technician
    let technicianId: string | null = null;
    const technician = await TechnicianModel.findOne({
      userId: new Types.ObjectId(userId),
      tenantId: tenantObjectId,
      deletedAt: null,
    }).lean();
    
    if (technician) {
      technicianId = String(technician._id);
    }

    return NextResponse.json({ 
      data: allEvents, 
      total: allEvents.length,
      technicianId,
    });
  } catch (error) {
    console.error('[all-calendar] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}