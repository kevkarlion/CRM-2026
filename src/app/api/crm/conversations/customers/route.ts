import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import ClientModel from '@/crm/models/client';
import { Types } from 'mongoose';

/**
 * GET /api/crm/conversations/customers
 * Devuelve conversaciones de clientes con atención activa para el Pipeline
 * 
 * Estados activos: ACTIVE_CLIENT, WAITING_CLIENT, IN_PROGRESS
 * Excluye: RESOLVED, CLOSED, EXPIRED
 */
export async function GET(req: NextRequest) {
  try {
    const tenantId = req.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id required' }, { status: 401 });
    }

    await connectDB();

    // Buscar conversaciones de clientes con estado activo
    const activeConversations = await ConversationModel.find({
      tenantId: new Types.ObjectId(tenantId),
      conversationType: 'customer',
      lifecycleState: { $in: ['ACTIVE_CLIENT', 'WAITING_CLIENT', 'IN_PROGRESS'] },
    })
      .sort({ lastMessageAt: -1 })
      .lean();

    if (activeConversations.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Obtener los phoneNumbers únicos
    const phoneNumbers = [...new Set(activeConversations.map(c => c.phoneNumber))];

    // Buscar clientes por phoneNumber
    const clients = await ClientModel.find({
      tenantId: new Types.ObjectId(tenantId),
      phone: { $in: phoneNumbers },
      deletedAt: null,
    }).lean();

    // Buscar clientes por phoneNumber - búsqueda más flexible
    const allClients = await ClientModel.find({
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    }).lean();

    // Crear mapa de phone -> client (múltiples formatos)
    const clientMap = new Map<string, any>();
    for (const client of allClients) {
      const phone = client.phone || '';
      if (phone) {
        // Guardar con el teléfono original
        const normalizedPhone = phone.replace(/[\s\-\(\)\+]/g, '').replace(/^0/, '');
        clientMap.set(normalizedPhone, client);
        // También guardar sin el +
        clientMap.set(phone.replace(/^\+/, ''), client);
        // Y guardar el original
        clientMap.set(phone, client);
      }
    }

    // Enriquecer conversaciones con datos del cliente
    const enrichedConversations = activeConversations.map(conv => {
      const phoneNumber = conv.phoneNumber || '';
      // Buscar en el mapa con diferentes normalizaciones
      let client = clientMap.get(phoneNumber);
      if (!client) {
        const normalized = phoneNumber.replace(/[\s\-\(\)\+]/g, '').replace(/^0/, '');
        client = clientMap.get(normalized);
      }
      if (!client) {
        const normalized = phoneNumber.replace(/^\+/, '');
        client = clientMap.get(normalized);
      }
      
      return {
        conversationId: String(conv._id),
        phoneNumber: conv.phoneNumber,
        lifecycleState: conv.lifecycleState,
        owner: conv.owner,
        lastMessageAt: conv.lastMessageAt,
        lastActivityAt: conv.lastActivityAt,
        waitingMessageCount: conv.waitingMessageCount,
        waitingPriority: conv.waitingPriority,
        assignedToUserId: conv.assignedToUserId ? String(conv.assignedToUserId) : null,
        // Datos del cliente
        clientId: client ? String(client._id) : null,
        clientName: client?.companyName || client?.fullName || 'Cliente sin registrar',
        clientPhone: client?.phone || null,
        // Score y temperatura - vienen de la conversación (calculados por el bot)
        clientScore: (conv as any).score ?? null,
        clientTemperature: (conv as any).temperature ?? null,
      };
    });

    return NextResponse.json({ data: enrichedConversations });
  } catch (error: any) {
    console.error('[conversations/customers] error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
