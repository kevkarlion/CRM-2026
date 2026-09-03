import { NextRequest, NextResponse } from 'next/server';
import { eventBus } from '@/infrastructure/events/event-bus';
import { DOMAIN_EVENTS } from '@/infrastructure/events/event.types';
import ClientModel from '@/crm/models/client';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    
    console.log('[clients/resolve] 🚀 START - clientId:', clientId, 'tenantId:', tenantId, 'userId:', userId);
    
    if (!tenantId || !userId) {
      console.log('[clients/resolve] ❌ Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify client exists
    const client = await ClientModel.findOne({
      _id: new Types.ObjectId(clientId),
      tenantId: new Types.ObjectId(tenantId),
    }).lean();

    if (!client) {
      console.log('[clients/resolve] ❌ Client not found:', clientId);
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    console.log('[clients/resolve] ✅ Client found:', { id: client._id, fullName: client.fullName });

    // Publish CLIENT_RESOLVED event (closes current Gestion, saves history, creates new one)
    console.log('[clients/resolve] 📤 Publishing CLIENT_RESOLVED event');
    console.log('[clients/resolve] 📤 Payload:', { clientId, resolvedBy: userId, tenantId, userId });
    
    await eventBus.publish({
      type: DOMAIN_EVENTS.CLIENT_RESOLVED,
      tenantId,
      userId,
      aggregateType: 'client',
      aggregateId: clientId,
      payload: {
        clientId,
        resolvedBy: String(userId),
      },
    });

    console.log('[clients/resolve] ✅ Event published successfully');

    return NextResponse.json({ 
      success: true, 
      message: 'Ciclo cerrado correctamente - Nueva gestión creada',
    });
  } catch (error: any) {
    console.error('[clients/resolve] ❌ POST error:', error?.message || error, error?.stack);
    return NextResponse.json({ error: error?.message || 'Error al cerrar ciclo' }, { status: 500 });
  }
}