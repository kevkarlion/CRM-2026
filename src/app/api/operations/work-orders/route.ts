import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { WorkOrderService, ValidationError } from '@/operations/services/work-order.service';
import type { CreateWorkOrderInput } from '@/operations/types/work-order';

const service = new WorkOrderService();

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const status = searchParams.get('status') || undefined;
    const type = searchParams.get('type') || undefined;
    const technicianId = searchParams.get('technicianId') || undefined;
    const clientId = searchParams.get('clientId') || undefined;
    const leadId = searchParams.get('leadId') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const search = searchParams.get('search') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const expired = searchParams.get('expired') || undefined;
    const workStatus = searchParams.get('workStatus') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const filters: Record<string, unknown> = {};
    if (status === 'not_closed') {
      // Excluir solo closed y cancelled, pero permitir vencidas
      filters.status = { $nin: ['closed', 'cancelled'] };
    } else if (status) {
      filters.status = status;
    }
if (expired === 'true') {
      // Usar timezone de Argentina (UTC-3) para calcular "hoy"
      const now = new Date();
      const argentinaOffset = -3 * 60; // UTC-3 en minutos
      const localTime = new Date(now.getTime() + (now.getTimezoneOffset() + argentinaOffset) * 60000);
      const todayStr = localTime.toISOString().split('T')[0];
      
      // Last 30 days but BEFORE today (not including today - use Lt not Lte)
      const thirtyDaysAgo = new Date(localTime);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
      
      filters.scheduledDateGte = thirtyDaysAgoStr;
      filters.scheduledDateLt = todayStr;  // Cambiado a Lt para EXCLUIR las de hoy
      filters.statusNin = ['completed', 'cancelled', 'closed'];
      filters.workStatus = { $nin: ['paused', 'cancelled'] };
    }
    if (type === 'technical_visit') {
      filters.source = 'technical_visit';
    } else if (type === 'work_order') {
      filters.source = { $in: ['lead_conversion', 'maintenance_contract', 'direct_sale', 'manual'] };
    }
    if (technicianId) filters.technicianId = technicianId;
    if (clientId) filters.clientId = clientId;
    if (leadId) filters.leadId = leadId;
    if (from || to) {
      filters.scheduledDateGte = from || undefined;
      filters.scheduledDateLte = to || undefined;
    }
    if (search) {
      filters.search = search;
      
      // También buscar por nombre de técnico
      const techRegex = new RegExp(search, 'i');
      const TechnicianModel = (await import('@/operations/models/technician')).TechnicianModel;
      const matchingTechs = await TechnicianModel.find({
        name: techRegex,
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      }).select('_id').lean();
      const techIds = matchingTechs.map(t => t._id);
      if (techIds.length > 0) {
        (filters as any).techSearch = { assignedTechnicians: { $in: techIds } };
      }
    }
    if (priority) filters.priority = priority;
    if (workStatus) {
      filters.workStatus = workStatus;
      // Si filtra por active, excluir las cerradas (ya que se muestran como completed)
      if (workStatus === 'active') {
        filters.status = { $ne: 'closed' };
      }
    }
    
    // Filtros especiales de_programada + asignada
    if (searchParams.get('assignedTechnicians') === 'none') {
      filters.assignedTechnicians = { $size: 0 };
    }
    if (searchParams.get('scheduledDate') === 'none') {
      filters.scheduledDate = { $exists: false };
    }
    if (searchParams.get('hasScheduledDate') === 'true') {
      filters.scheduledDate = { $exists: true, $ne: null };
    }
    if (searchParams.get('hasTechnician') === 'true') {
      filters.assignedTechnicians = { $exists: true, $ne: [], $not: { $size: 0 } };
    }
    // Filter: órdenes activas para técnicos (no vencidas, no cerradas)
    if (searchParams.get('techActive') === 'true') {
      (filters as any).techActive = 'true';
    }

    filters.limit = limit;
    filters.skip = skip;
    
    const result = await service.findByTenant(tenantId, filters as any);

    return NextResponse.json({ data: result.data, total: result.total, page, limit });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id') || '';
    const userId = request.headers.get('x-user-id') || '';
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'x-tenant-id and x-user-id headers are required' }, { status: 400 });
    }

    const body = await request.json() as CreateWorkOrderInput;
    const data = await service.create(body, tenantId, userId);

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    // CastError = mongoose error por ID inválido
    if ((error as any).name === 'CastError') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
