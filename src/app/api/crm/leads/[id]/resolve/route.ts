import { NextRequest, NextResponse } from 'next/server';
import { eventBus } from '@/infrastructure/events/event-bus';
import { DOMAIN_EVENTS } from '@/infrastructure/events/event.types';
import LeadModel from '@/leads/models/lead';
import ClientModel from '@/crm/models/client';
import { Types } from 'mongoose';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the lead
    const lead = await LeadModel.findOne({
      _id: new Types.ObjectId(leadId),
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });
    }

    // Buscar o crear cliente desde el lead
    let clientId = (lead as any).clientId || (lead as any).convertedToClient;

    if (!clientId) {
      // Buscar si ya existe cliente con ese teléfono
      const existingClient = await ClientModel.findOne({
        tenantId: new Types.ObjectId(tenantId),
        phone: lead.phone,
        deletedAt: null,
      }).lean();

      if (existingClient) {
        clientId = String(existingClient._id);
      } else {
        // Crear cliente desde el lead
        const newClient = await ClientModel.create({
          tenantId: new Types.ObjectId(tenantId),
          fullName: lead.name,
          companyName: lead.companyName,
          phone: lead.phone,
          email: lead.email,
          address: lead.address,
          locality: lead.locality,
          province: lead.province,
          source: lead.source,
          status: 'active',
          operationStatus: 'none',
          createdBy: new Types.ObjectId(userId),
          updatedBy: new Types.ObjectId(userId),
        });
        clientId = String(newClient._id);
      }

      // Actualizar lead con el clientId
      await LeadModel.updateOne(
        { _id: lead._id },
        { $set: { clientId: new Types.ObjectId(clientId) } }
      );
    }

    // Publish LEAD_RESOLVED event (handler crea gestión)
    await eventBus.publish({
      type: DOMAIN_EVENTS.LEAD_RESOLVED,
      tenantId,
      userId,
      payload: {
        leadId,
        clientId: String(clientId),
        resolvedBy: String(userId),
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Lead resuelto correctamente',
    });
  } catch (error: any) {
    console.error('[leads/resolve] POST error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error al resolver lead' }, { status: 500 });
  }
}