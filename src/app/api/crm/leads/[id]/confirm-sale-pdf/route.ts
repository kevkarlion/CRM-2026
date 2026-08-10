import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';
import ClientModel from '@/crm/models/client';
import WorkOrderModel from '@/operations/models/work-order';
import { Types } from 'mongoose';
import { getNextWorkOrderNumber } from '@/operations/helpers/counter';
import { eventBus } from '@/infrastructure/events/event-bus';
import { DOMAIN_EVENTS } from '@/infrastructure/events/event.types';

/**
 * POST /api/crm/leads/[id]/confirm-sale-pdf
 * Confirma venta directa desde PDF:
 * - Cambia lead.status a 'won'
 * - Crea cliente desde el lead
 * - Crea OT en estado 'pending_assignment' (borrador)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = req.headers.get('x-tenant-id');
    const userId = req.headers.get('x-user-id');
    
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id required' }, { status: 401 });
    }

    await connectDB();

    // Estados válidos para confirmar venta
    const validStatuses = ['new', 'contacted', 'quote_sent', 'technical_visit', 'negotiation'];
    
    const lead = await LeadModel.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });
    }

    if (!validStatuses.includes(lead.status)) {
      return NextResponse.json({ 
        error: `No se puede confirmar venta desde estado '${lead.status}'. Estados válidos: ${validStatuses.join(', ')}` 
      }, { status: 400 });
    }

    if (lead.convertedToClient) {
      return NextResponse.json({ error: 'Este lead ya fue convertido a cliente' }, { status: 400 });
    }

    // 1. Crear cliente desde el lead
    const clientNotes = `Cliente creado desde Lead #${lead._id}\nVenta confirmada directamente por PDF`;
    
    const [client] = await ClientModel.create([
      {
        tenantId: new Types.ObjectId(tenantId),
        customerType: lead.customerType || 'residential',
        fullName: lead.name,
        companyName: lead.companyName,
        email: lead.email,
        phone: lead.phone,
        status: 'active',
        source: lead.source,
        address: lead.address,
        locality: lead.locality,
        province: lead.province,
        notes: clientNotes,
        createdBy: userId ? new Types.ObjectId(userId) : new Types.ObjectId(),
        updatedBy: userId ? new Types.ObjectId(userId) : new Types.ObjectId(),
      },
    ]);

    console.log('[confirm-sale-pdf] Cliente creado:', client._id);

    // 2. Actualizar lead: estado = won, convertedToClient = client._id, convertedAt = now
    await LeadModel.findByIdAndUpdate(id, {
      $set: {
        status: 'won',
        convertedToClient: client._id,
        convertedAt: new Date(),
        updatedBy: userId || 'admin-action',
      },
    });

    // 3. Crear OT en estado pending_assignment (borrador)
    const tenantPrefix = tenantId.toString().slice(-6);
    const workOrderNumber = await getNextWorkOrderNumber(tenantPrefix);
    const clientName = lead.companyName || lead.name;

    const [workOrder] = await WorkOrderModel.create([
      {
        tenantId: new Types.ObjectId(tenantId),
        clientId: client._id,
        leadId: lead._id,
        clientSnapshot: {
          name: clientName,
          email: lead.email,
          phone: lead.phone,
          companyName: lead.companyName || '',
          customerType: lead.customerType || 'residential',
          status: 'active',
        },
        locationSnapshot: {
          name: clientName,
          address: lead.address || '',
        },
        source: 'direct_sale',
        category: 'installation',
        workOrderNumber,
        title: `Venta: ${clientName}`,
        description: `Venta generada desde lead #${lead._id} por confirmación PDF`,
        status: 'draft',
        priority: 'normal',
        createdBy: userId ? new Types.ObjectId(userId) : new Types.ObjectId(),
        updatedBy: userId ? new Types.ObjectId(userId) : new Types.ObjectId(),
      },
    ]);

    console.log('[confirm-sale-pdf] OT creada:', workOrder._id, 'estado: draft');

    // Emitir evento para ActivityLog y Timeline
    try {
      await eventBus.publish({
        type: DOMAIN_EVENTS.WORK_ORDER_CREATED,
        aggregateId: workOrder._id.toString(),
        aggregateType: 'WorkOrder',
        tenantId,
        userId: userId || undefined,
        timestamp: new Date(),
        payload: {
          workOrderId: workOrder._id.toString(),
          leadId: lead._id.toString(),
          number: workOrderNumber,
          clientId: client._id.toString(),
          title: workOrder.title,
          category: workOrder.category,
          priority: workOrder.priority,
          scheduledDate: workOrder.scheduledDate,
          clientName: clientName,
          address: lead.address || undefined,
        },
      });
    } catch (eventError) {
      console.error('[confirm-sale-pdf] Failed to publish WORK_ORDER_CREATED:', eventError);
    }

    return NextResponse.json({ 
      success: true, 
      lead: {
        _id: String(lead._id),
        status: 'won',
        convertedToClient: String(client._id),
      },
      client: {
        _id: String(client._id),
      },
      workOrder: {
        _id: String(workOrder._id),
        workOrderNumber,
        status: 'draft',
      }
    });
  } catch (error: any) {
    console.error('[confirm-sale-pdf] error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
