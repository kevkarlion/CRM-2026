import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import WorkOrderModel from '@/operations/models/work-order';
import { TechnicianModel } from '@/operations/models/technician';
import { Types } from 'mongoose';

/**
 * GET /api/operations/work-orders/my-orders
 * Devuelve SOLO las órdenes de trabajo del técnico logueado.
 * Por defecto filtra: no draft, no vencidas, no cerradas.
 * Solo devuelve OTs con scheduledDate >= hoy, o sin fecha, o en ejecución.
 */
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

    // Buscar el técnico asociado al usuario
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

    // Calcular "hoy" en timezone Argentina (UTC-3)
    const now = new Date();
    const argentinaOffset = -3 * 60;
    const localNow = new Date(now.getTime() + (now.getTimezoneOffset() + argentinaOffset) * 60000);
    
    // Formatear fecha en formato YYYY-MM-DD en hora local Argentina
    const year = localNow.getFullYear();
    const month = String(localNow.getMonth() + 1).padStart(2, '0');
    const day = String(localNow.getDate()).toString().padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // Check for expired filter and status filter
    const { searchParams } = new URL(request.url);
    const expired = searchParams.get('expired');
    const statusFilter = searchParams.get('status');
    const closedDate = searchParams.get('closedDate');

    // Default query: solo órdenes activas del técnico
    let query: Record<string, unknown> = {
      tenantId: tenantObjectId,
      assignedTechnicians: technician._id,
      deletedAt: null,
    };

    // Apply closedDate filter if provided (for today's closed orders)
    if (closedDate) {
      query.closedAt = { $gte: closedDate, $lt: closedDate + 'T23:59:59' };
    }

    // Apply status filter
    if (statusFilter === 'not_closed') {
      // Excluir closed/cancelled en status O en workStatus
      query.status = { $nin: ['closed', 'cancelled'] };
      query.workStatus = { $nin: ['cancelled'] };
    } else if (statusFilter) {
      query.status = statusFilter;
    } else {
      // Default: exclude draft, closed, cancelled
      query.status = { $nin: ['draft', 'closed', 'cancelled'] };
      query.workStatus = { $nin: ['cancelled'] };
    }

    if (expired === 'true') {
      // Show expired orders (last 30 days, before today)
      const thirtyDaysAgo = new Date(localNow);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
      
      query = {
        ...query,
        scheduledDate: { $gte: thirtyDaysAgoStr, $lt: todayStr },
        workStatus: { $nin: ['paused', 'cancelled'] },
      };
    }

    // REMOVIDO: el filtro adicional por fecha/workStatus que excluía órdenes

    const workOrders = await WorkOrderModel.find(query)
      .populate('assignedTechnicians', 'name email phone')
      .sort({ scheduledDate: 1, scheduledStart: 1 })
      .lean();

    const data = workOrders.map((wo) => ({
      _id: String(wo._id),
      workOrderNumber: wo.workOrderNumber,
      title: wo.title,
      status: wo.status,
      priority: wo.priority,
      category: wo.category,
      source: wo.source,
      createdAt: wo.createdAt,
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

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}