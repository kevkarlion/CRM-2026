import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import WorkOrderModel from '@/operations/models/work-order';
import { TechnicalVisitModel } from '@/operations/models/technical-visit';
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

    // Find technician by userId
    const technician = await TechnicianModel.findOne({
      userId: userObjectId,
      tenantId: tenantObjectId,
      deletedAt: null,
    }).lean();

    if (!technician) {
      return NextResponse.json({
        assignedCount: 0,
        completedToday: 0,
        pendingOrders: 0,
        inProgressOrders: 0,
        upcomingSevenDays: 0,
        sla: { onTime: 0, delayed: 0, avgResponseTimeHours: null },
        technicianLoad: [],
        workOrders: [],
        generatedAt: new Date().toISOString(),
      });
    }

    const technicianId = technician._id;
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get assigned work orders count (status: assigned, in_progress, paused)
    const inProgressOrders = await WorkOrderModel.countDocuments({
      tenantId: tenantObjectId,
      assignedTechnicians: { $in: [technicianId] },
      deletedAt: null,
      status: { $in: ['assigned', 'in_progress', 'paused'] },
    });

    // Get completed today
    const completedToday = await WorkOrderModel.countDocuments({
      tenantId: tenantObjectId,
      assignedTechnicians: { $in: [technicianId] },
      deletedAt: null,
      status: 'completed',
      updatedAt: { $gte: todayStart, $lt: todayEnd },
    });

    // Get pending (scheduled for future)
    const pendingOrders = await WorkOrderModel.countDocuments({
      tenantId: tenantObjectId,
      assignedTechnicians: { $in: [technicianId] },
      deletedAt: null,
      status: { $in: ['scheduled', 'confirmed'] },
    });

    // Get upcoming 7 days
    const upcomingSevenDays = await WorkOrderModel.countDocuments({
      tenantId: tenantObjectId,
      assignedTechnicians: { $in: [technicianId] },
      deletedAt: null,
      status: { $in: ['scheduled', 'confirmed', 'assigned'] },
      scheduledDate: { $gte: now.toISOString().split('T')[0], $lte: sevenDaysFromNow.toISOString().split('T')[0] },
    });

    // Calculate SLA for this technician
    const completedWO = await WorkOrderModel.find({
      tenantId: tenantObjectId,
      assignedTechnicians: { $in: [technicianId] },
      deletedAt: null,
      status: 'completed',
      updatedAt: { $gte: thirtyDaysAgo },
    }).select('createdAt updatedAt').lean();

    let onTime = 0;
    let delayed = 0;
    let totalHours = 0;

    for (const wo of completedWO) {
      const hours = (new Date(wo.updatedAt).getTime() - new Date(wo.createdAt).getTime()) / (1000 * 60 * 60);
      totalHours += hours;
      if (hours <= 48) onTime++;
      else delayed++;
    }

    // Get work orders for this technician
    const workOrders = await WorkOrderModel.find({
      tenantId: tenantObjectId,
      assignedTechnicians: { $in: [technicianId] },
      deletedAt: null,
    })
      .populate('assignedTechnicians', 'name email phone')
      .sort({ scheduledDate: 1, scheduledStart: 1 })
      .limit(50)
      .lean();

    // Map work orders to TechnicianWorkOrder format
    const workOrdersData = workOrders.map((wo) => ({
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
      assignedTechnicians: wo.assignedTechnicians,
    }));

    const technicalVisits = await TechnicalVisitModel.find({
      tenantId: tenantObjectId,
      assignedTechnicianId: technicianId,
      deletedAt: null,
    })
      .sort({ scheduledDate: 1, scheduledStart: 1 })
      .limit(50)
      .lean();

    // === NUEVO: Datos globales para el técnico ===
    // Órdenes totales en el CRM (sin asignar) - para auto-asignación
    const totalUnassignedOrders = await WorkOrderModel.countDocuments({
      tenantId: tenantObjectId,
      deletedAt: null,
      status: { $in: ['scheduled', 'confirmed'] },
      assignedTechnicians: { $size: 0 },
    });

    // Órdenes por vencer (próximos 2 días, no asignadas al técnico actual)
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    const ordersExpiringSoon = await WorkOrderModel.countDocuments({
      tenantId: tenantObjectId,
      deletedAt: null,
      status: { $in: ['scheduled', 'confirmed'] },
      scheduledDate: { 
        $gte: now.toISOString().split('T')[0], 
        $lte: twoDaysFromNow.toISOString().split('T')[0] 
      },
    });

    // Órdenes urgentes (prioridad high, urgent, emergency) - no completadas
    const urgentOrders = await WorkOrderModel.countDocuments({
      tenantId: tenantObjectId,
      deletedAt: null,
      status: { $nin: ['completed', 'cancelled', 'closed'] },
      priority: { $in: ['high', 'urgent', 'emergency'] },
    });

    // Visitas técnicas totales (sin asignar o del técnico)
    const totalUnassignedVisits = await TechnicalVisitModel.countDocuments({
      tenantId: tenantObjectId,
      deletedAt: null,
      status: { $in: ['scheduled', 'confirmed'] },
      assignedTechnicianId: null,
    });

    // === Órdenes y Visitas Vencidas ===
    const todayStr = now.toISOString().split('T')[0];
    
    // Órdenes de trabajo vencidas (fecha programada < hoy Y no completada)
    const expiredOrders = await WorkOrderModel.countDocuments({
      tenantId: tenantObjectId,
      deletedAt: null,
      status: { $nin: ['completed', 'cancelled', 'closed'] },
      scheduledDate: { $lt: todayStr },
    });

    // Visitas técnicas vencidas (el campo es Date en el modelo)
    const todayStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const expiredVisits = await TechnicalVisitModel.countDocuments({
      tenantId: tenantObjectId,
      deletedAt: null,
      status: { $nin: ['completed', 'cancelled', 'converted_to_work_order'] },
      scheduledDate: { $lt: todayStartDate },
    });

    // Órdenes por vencer (próximos 3 días, no asignadas al técnico actual)
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const ordersDueSoon = await WorkOrderModel.countDocuments({
      tenantId: tenantObjectId,
      deletedAt: null,
      status: { $nin: ['completed', 'cancelled', 'closed'] },
      scheduledDate: { 
        $gte: todayStr, 
        $lte: threeDaysFromNow.toISOString().split('T')[0] 
      },
    });

    // Visitas por vencer (próximos 3 días)
    const visitsDueSoon = await TechnicalVisitModel.countDocuments({
      tenantId: tenantObjectId,
      deletedAt: null,
      status: { $nin: ['completed', 'cancelled', 'converted_to_work_order'] },
      scheduledDate: { 
        $gte: todayStartDate, 
        $lte: threeDaysFromNow 
      },
    });

    const technicalVisitsData = technicalVisits.map((tv) => ({
      _id: String(tv._id),
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
    }));

    // Combine work orders and technical visits
    const allWorkOrders = [...workOrdersData, ...technicalVisitsData];

    // Get technician load (just this technician)
    const maxDailyLoad = (technician as any).maxDailyWorkOrders || 8;
    const technicianLoad = [{
      techId: String(technicianId),
      name: technician.name || `${technician.firstName || ''} ${technician.lastName || ''}`.trim() || 'Técnico',
      assignedCount: inProgressOrders + pendingOrders + (technicalVisits?.length || 0),
      maxDailyLoad,
    }];

    return NextResponse.json({
      assignedCount: inProgressOrders + pendingOrders + (technicalVisits?.length || 0),
      completedToday,
      pendingOrders,
      inProgressOrders,
      upcomingSevenDays,
      // Nuevos campos para el técnico
      globalStats: {
        totalUnassignedOrders,
        totalUnassignedVisits,
        ordersExpiringSoon,
        urgentOrders,
        // Nuevos: vencidas y por vencer
        expiredOrders,
        expiredVisits,
        ordersDueSoon,
        visitsDueSoon,
      },
      maxDailyLoad, // Límite diario del técnico desde la DB
      sla: {
        onTime,
        delayed,
        avgResponseTimeHours: completedWO.length > 0
          ? Math.round((totalHours / completedWO.length) * 10) / 10
          : null,
      },
      technicianLoad,
      workOrders: allWorkOrders,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}