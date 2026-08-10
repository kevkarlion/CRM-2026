import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ClientModel from '@/crm/models/client';
import ConversationModel from '@/conversation/models/conversation';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';

/**
 * GET /api/crm/clients/with-active-conversation
 * Devuelve clientes que tienen una conversación activa con el bot
 * 
 * Un cliente tiene conversación activa con el bot cuando:
 * - Fue convertido de un lead Y ese lead tiene una conversación activa con el bot
 */
export async function GET(req: NextRequest) {
  try {
    const tenantId = req.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id required' }, { status: 401 });
    }

    await connectDB();

    // Buscar conversaciones activas donde el bot está activo (no resolved, no closed)
    // y que tienen un leadId
    const activeConversations = await ConversationModel.find({
      tenantId: new Types.ObjectId(tenantId),
      lifecycleState: { $nin: ['RESOLVED', 'CLOSED'] },
      owner: 'BOT',
      leadId: { $exists: true },
    }).lean();

    // Extraer los leadIds únicos
    const leadIds = [...new Set(
      activeConversations
        .filter(c => c.leadId)
        .map(c => String(c.leadId))
    )];

    // Si no hay conversaciones activas, devolver vacío
    if (leadIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Buscar leads que tienen convertedToClient (fueron convertidos a clientes)
    const convertedLeads = await LeadModel.find({
      _id: { $in: leadIds.map(id => new Types.ObjectId(id)) },
      tenantId: new Types.ObjectId(tenantId),
      convertedToClient: { $exists: true },
    }).lean();

    // Extraer los clientIds únicos de los leads convertidos
    const clientIds = [...new Set(
      convertedLeads
        .filter(l => l.convertedToClient)
        .map(l => String(l.convertedToClient))
    )];

    // Si no hay clientes convertidos, devolver vacío
    if (clientIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Buscar los clientes correspondientes
    const clients = await ClientModel.find({
      _id: { $in: clientIds.map(id => new Types.ObjectId(id)) },
      tenantId: new Types.ObjectId(tenantId),
    }).lean();

    return NextResponse.json({ data: clients });
  } catch (error: any) {
    console.error('[clients/with-active-conversation] error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
