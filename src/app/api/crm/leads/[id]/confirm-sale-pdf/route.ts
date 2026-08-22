import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';
import ClientModel from '@/crm/models/client';
import WorkOrderModel from '@/operations/models/work-order';
import ConversationModel from '@/conversation/models/conversation';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
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

    // Optional body: quoteId if reusing existing quote (from document flow)
    let quoteId: string | undefined;
    try {
      const body = await req.json();
      quoteId = body.quoteId;
    } catch {
      // No body or empty body is fine
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

    // If quoteId provided, use existing quote; otherwise create new one
    let quoteNumber: string;
    if (quoteId) {
      const QuoteModel = (await import('@/quotes/models/quote')).default;
      const existingQuote = await QuoteModel.findOne({
        _id: new Types.ObjectId(quoteId),
        tenantId: new Types.ObjectId(tenantId),
      });
      if (!existingQuote) {
        return NextResponse.json({ error: 'Quote no encontrado' }, { status: 404 });
      }
      quoteNumber = existingQuote.number;
    }

    // 1. Crear cliente desde el lead
    const clientNotes = `Cliente creado desde Lead #${lead._id}\nVenta confirmada directamente por PDF`;
    
    const [client] = await ClientModel.create([
      {
        tenantId: new Types.ObjectId(tenantId),
        customerType: lead.customerType || 'residential',
        fullName: lead.name,
        companyName: lead.companyName,
        profileName: (lead as any).profileName || lead.companyName,
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

    // 1.1 Crear contacto primario desde el lead
    const ContactModel = (await import('@/crm/models/contact')).default;
    const nameParts = lead.name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    await ContactModel.create([{
      tenantId: new Types.ObjectId(tenantId),
      clientId: client._id,
      firstName,
      lastName,
      email: lead.email || undefined,
      phone: lead.phone || undefined,
      isPrimary: true,
      createdBy: userId ? new Types.ObjectId(userId) : new Types.ObjectId(),
      updatedBy: userId ? new Types.ObjectId(userId) : new Types.ObjectId(),
    }]);

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

    // 2.1 Migrar conversación de lead a cliente
    console.log('[confirm-sale-pdf] Migrando conversación - leadId:', lead._id, 'clientId:', client._id);
    const convResult = await ConversationModel.updateMany(
      { leadId: lead._id, conversationType: 'lead' },
      {
        $set: {
          clientId: client._id,
          conversationType: 'customer',
          lifecycleState: 'ACTIVE_CLIENT',
          'engineData.isCustomer': true,
          'engineData.clientId': String(client._id),
        },
      }
    );
    console.log('[confirm-sale-pdf] Conversaciones migradas:', convResult.modifiedCount);

    // 2.1.1 Agregar phoneNumber a la conversación para poder buscar por teléfono
    if (lead.phone) {
      const phoneNumberUpdate = await ConversationModel.updateMany(
        { leadId: lead._id, phoneNumber: { $exists: false } },
        { $set: { phoneNumber: lead.phone } }
      );
      console.log('[confirm-sale-pdf] phoneNumber agregado a conversaciones:', phoneNumberUpdate.modifiedCount);
    }

    // 2.2 Migrar mensajes de WhatsApp del lead al cliente
    console.log('[confirm-sale-pdf] Migrando mensajes - leadId:', lead._id, 'clientId:', client._id);
    const msgResult = await WhatsAppMessageModel.updateMany(
      { leadId: lead._id },
      { $set: { clientId: client._id } }
    );
    console.log('[confirm-sale-pdf] Mensajes migrados:', msgResult.modifiedCount);

    // 3. Crear OT en estado pending_assignment (borrador)
    const tenantPrefix = tenantId.toString().slice(-6);
    const workOrderNumber = await getNextWorkOrderNumber(tenantPrefix);
    const clientName = lead.companyName || lead.name;

    const [workOrder] = await WorkOrderModel.create([
      {
        tenantId: new Types.ObjectId(tenantId),
        clientId: client._id,
        leadId: lead._id,
        quoteId: quoteId ? new Types.ObjectId(quoteId) : null,
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

    // Link the work order to the quote so decision engine knows it exists
    if (quoteId) {
      const QuoteModel = (await import('@/quotes/models/quote')).default;
      await QuoteModel.updateOne(
        { _id: new Types.ObjectId(quoteId) },
        { $set: { convertedToWorkOrder: workOrder._id } }
      );
    }

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
