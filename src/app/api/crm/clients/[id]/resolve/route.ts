import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: clientId } = await params;
    const tenantId = session.user.tenantId || 'default';
    const userId = session.user.id || session.user.email;

    // Verify client exists
    const client = await ClientModel.findOne({
      _id: new Types.ObjectId(clientId),
      tenantId: new Types.ObjectId(tenantId),
    }).lean();

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Find the associated lead to resolve (if any)
    const lead = await LeadModel.findOne({
      clientId: new Types.ObjectId(clientId),
      tenantId: new Types.ObjectId(tenantId),
      status: 'won',
    }).lean();

    const leadId = lead ? String(lead._id) : undefined;

    // Publish RESOLVE_CONVERTED_LEAD event
    await eventBus.publish({
      type: DOMAIN_EVENTS.RESOLVE_CONVERTED_LEAD,
      tenantId,
      userId,
      payload: {
        leadId,
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