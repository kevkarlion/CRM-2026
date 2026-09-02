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
    
    console.log('[leads/resolve] 🚀 START - leadId:', leadId, 'tenantId:', tenantId, 'userId:', userId);
    
    if (!tenantId || !userId) {
      console.log('[leads/resolve] ❌ Unauthorized - missing tenantId or userId');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the lead
    const lead = await LeadModel.findOne({
      _id: new Types.ObjectId(leadId),
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!lead) {
      console.log('[leads/resolve] ❌ Lead not found:', leadId);
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });
    }

    console.log('[leads/resolve] ✅ Lead found:', { 
      id: lead._id, 
      name: lead.name, 
      phone: lead.phone,
      status: lead.status,
      clientId: (lead as any).clientId,
      convertedToClient: (lead as any).convertedToClient
    });

    // Buscar o crear cliente desde el lead
    let clientId = (lead as any).clientId || (lead as any).convertedToClient;

    if (!clientId) {
      console.log('[leads/resolve] ℹ️ No clientId found, searching/creating...');
      
      // Buscar si ya existe cliente con ese teléfono
      const existingClient = await ClientModel.findOne({
        tenantId: new Types.ObjectId(tenantId),
        phone: lead.phone,
        deletedAt: null,
      }).lean();

      if (existingClient) {
        clientId = String(existingClient._id);
        console.log('[leads/resolve] ℹ️ Using existing client:', clientId);
      } else {
        // Crear cliente desde el lead
        console.log('[leads/resolve] 🐛 inheritNotes check - lead.adminNotes:', JSON.stringify((lead as any).adminNotes));
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
          inheritNotes: (lead as any).adminNotes || undefined,
          createdBy: new Types.ObjectId(userId),
          updatedBy: new Types.ObjectId(userId),
        });
        clientId = String(newClient._id);
        console.log('[leads/resolve] ✅ Created new client:', clientId, '| inheritNotes:', JSON.stringify(newClient.inheritNotes));
      }

      // Actualizar lead con el clientId
      await LeadModel.updateOne(
        { _id: lead._id },
        { $set: { clientId: new Types.ObjectId(clientId) } }
      );
      console.log('[leads/resolve] ✅ Updated lead with clientId');
    } else {
      console.log('[leads/resolve] ℹ️ Using existing clientId:', clientId);
    }

    // Publish LEAD_RESOLVED event (handler crea gestión)
    console.log('[leads/resolve] 📤 Publishing LEAD_RESOLVED event:', {
      leadId,
      clientId,
      resolvedBy: userId,
    });
    
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
    
    console.log('[leads/resolve] ✅ Event published successfully');

    return NextResponse.json({ 
      success: true, 
      message: 'Lead resuelto correctamente',
    });
  } catch (error: any) {
    console.error('[leads/resolve] ❌ POST error:', error?.message || error, error?.stack);
    return NextResponse.json({ error: error?.message || 'Error al resolver lead' }, { status: 500 });
  }
}