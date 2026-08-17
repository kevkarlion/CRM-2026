import { NextRequest, NextResponse } from 'next/server';
import { eventBus } from '@/infrastructure/events/event-bus';
import { DOMAIN_EVENTS } from '@/infrastructure/events/event.types';
import LeadModel from '@/leads/models/lead';
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

    // Get the lead to find associated client
    const lead = await LeadModel.findOne({
      _id: new Types.ObjectId(leadId),
      tenantId: new Types.ObjectId(tenantId),
    }).lean();

    if (!lead) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });
    }

    // Get clientId from the lead (it should have clientId if it's converted)
    const clientId = (lead as any).clientId;
    if (!clientId) {
      return NextResponse.json({ error: 'Lead no tiene cliente asociado' }, { status: 400 });
    }

    // Publish RESOLVE_CONVERTED_LEAD event
    await eventBus.publish({
      type: DOMAIN_EVENTS.RESOLVE_CONVERTED_LEAD,
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