import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ClientModel from '@/crm/models/client';
import WorkOrderModel from '@/operations/models/work-order';
import { Types } from 'mongoose';
import { getNextWorkOrderNumber } from '@/operations/helpers/counter';
import { eventBus } from '@/infrastructure/events/event-bus';
import { DOMAIN_EVENTS } from '@/infrastructure/events/event.types';

/**
 * POST /api/crm/clients/[id]/confirm-sale-pdf
 * Confirma venta desde cliente:
 * - Cambia operationStatus a 'sale_confirmed'
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

    const client = await ClientModel.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Actualizar estado de operación a venta confirmada
    await ClientModel.findByIdAndUpdate(id, {
      $set: {
        operationStatus: 'sale_confirmed',
        operationStatusUpdatedAt: new Date(),
        status: 'active',
      },
    });

    console.log('[confirm-sale-pdf] Cliente actualizado:', id, 'operationStatus: sale_confirmed');

    // Crear OT en estado pending_assignment (borrador)
    const tenantPrefix = tenantId.toString().slice(-6);
    const workOrderNumber = await getNextWorkOrderNumber(tenantPrefix);
    const clientName = client.companyName || client.fullName;

    const [workOrder] = await WorkOrderModel.create([
      {
        tenantId: new Types.ObjectId(tenantId),
        clientId: client._id,
        clientSnapshot: {
          name: clientName,
          email: client.email,
          phone: client.phone,
          companyName: client.companyName || '',
          customerType: client.customerType,
          status: 'active',
        },
        locationSnapshot: {
          name: clientName,
          address: client.address || '',
        },
        source: 'direct_sale',
        category: 'installation',
        workOrderNumber,
        title: `Venta: ${clientName}`,
        description: `Venta confirmada directamente por PDF para cliente #${client._id}`,
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
          leadId: null,
          number: workOrderNumber,
          clientId: client._id.toString(),
          title: workOrder.title,
          category: workOrder.category,
          priority: workOrder.priority,
          scheduledDate: workOrder.scheduledDate,
          clientName: clientName,
          address: client.address || undefined,
        },
      });
    } catch (eventError) {
      console.error('[confirm-sale-pdf] Failed to publish WORK_ORDER_CREATED:', eventError);
    }

    return NextResponse.json({ 
      success: true, 
      operationStatus: 'sale_confirmed',
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
