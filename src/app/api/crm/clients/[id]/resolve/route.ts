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
    
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify client exists
    const client = await ClientModel.findOne({
      _id: new Types.ObjectId(clientId),
      tenantId: new Types.ObjectId(tenantId),
    }).lean();

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Publish CLIENT_RESOLVED event (closes current Gestion and creates new one)
    await eventBus.publish({
      type: DOMAIN_EVENTS.CLIENT_RESOLVED,
      tenantId,
      userId,
      payload: {
        clientId,
        resolvedBy: String(userId),
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Cliente resuelto correctamente',
    });
  } catch (error: any) {
    console.error('[clients/resolve] POST error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error al resolver cliente' }, { status: 500 });
  }
}