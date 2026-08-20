import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ConversationModel from '@/conversation/models/conversation';
import ClientModel from '@/crm/models/client';
import LeadModel from '@/leads/models/lead';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import { Types } from 'mongoose';

/**
 * GET /api/crm/conversations/customers
 * Devuelve clientes para la columna "Clientes" del Pipeline
 * 
 * Muestra (por prioridad):
 * 1. Gestiones activas (si existen)
 * 2. Clients sin Gestion (si no hay Gestion para ese phone)
 * 3. Leads 'won' sin Client (último recurso)
 * 
 * Estados de conversación activos: ACTIVE_CLIENT, WAITING_CLIENT, IN_PROGRESS
 */
export async function GET(req: NextRequest) {
  try {
    const tenantId = req.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id required' }, { status: 401 });
    }

    await connectDB();
    const tenantIdObj = new Types.ObjectId(tenantId);

    // ===== 1. CLIENTS =====
    // Gestión ya no se usa - solo Clients
    const allClients = await ClientModel.find({
      tenantId: tenantIdObj,
      deletedAt: null,
    }).lean();

    // Crear mapa de phone -> Client
    const clientPhoneMap = new Map<string, any>();
    
    for (const c of allClients) {
      const phone = c.phone?.replace(/\D/g, '') || '';
      if (phone && !clientPhoneMap.has(phone)) {
        clientPhoneMap.set(phone, {
          type: 'client',
          id: String(c._id),
          clientId: String(c._id),
          name: c.companyName || c.fullName || 'Cliente',
          phone: c.phone,
          email: c.email,
          profileName: (c as any).profileName || c.companyName || null,
          address: c.address,
          locality: c.locality,
          province: c.province,
          status: c.status,
          operationStatus: c.operationStatus,
          temperature: c.temperature,
          score: c.score,
          source: 'client',
          lastActivityAt: c.updatedAt,
          createdAt: c.createdAt,
          hasActiveConversation: false,
        });
      }
    }

    // ===== 3. LEADS 'WON' (si no hay Client ni Gestion para ese phone) =====
    const wonLeads = await LeadModel.find({
      tenantId: tenantIdObj,
      status: 'won',
      deletedAt: null,
    }).lean();

    // Filtrar solo los que no tienen Client ni Gestion
    const wonLeadPhoneMap = new Map<string, any>();
    
    for (const l of wonLeads) {
      const phone = l.phone?.replace(/\D/g, '') || '';
      if (phone && !clientPhoneMap.has(phone) && !wonLeadPhoneMap.has(phone)) {
        wonLeadPhoneMap.set(phone, {
          type: 'lead-won',
          id: String(l._id),
          leadId: String(l._id),
          name: l.name || 'Lead ganado',
          phone: l.phone,
          email: l.email,
          profileName: (l as any).profileName || l.companyName,
          address: l.address,
          locality: l.locality,
          province: l.province,
          status: 'won',
          temperature: l.temperature,
          score: l.score,
          source: 'lead-won',
          lastActivityAt: l.updatedAt,
          createdAt: l.createdAt,
          hasActiveConversation: false,
        });
      }
    }

    // ===== 4. CONVERSACIONES ACTIVAS =====
    // Ahora buscar conversaciones activas para marcar cuáles tienen conversación
    const activeConversations = await ConversationModel.find({
      tenantId: tenantIdObj,
      conversationType: 'customer',
      lifecycleState: { $in: ['ACTIVE_CLIENT', 'WAITING_CLIENT', 'IN_PROGRESS'] },
    })
      .sort({ lastMessageAt: -1 })
      .lean();

    // Obtener TODOS los teléfonos de clientes (no solo los de conversaciones activas)
    const allClientPhones = [...clientPhoneMap.keys(), ...wonLeadPhoneMap.keys()];
    
    // Obtener los últimos mensajes inbound por phone para calcular "nueva actividad"
    const phoneNumbers = [
      ...new Set(activeConversations.map(c => (c as any).phoneNumber).filter(Boolean)),
      ...allClientPhones
    ];
    
    // Query para obtener el último mensaje inbound por teléfono
    const lastInboundMessages = await WhatsAppMessageModel.aggregate([
      {
        $match: {
          tenantId: tenantIdObj,
          phone: { $in: phoneNumbers },
          direction: 'inbound',
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: '$phone',
          lastInboundAt: { $first: '$createdAt' },
          lastMessagePreview: { $first: { $substr: ['$content', 0, 50] } },
        },
      },
    ]);

    // Crear mapa de phone -> lastInboundAt y lastMessagePreview
    const lastInboundMap = new Map<string, Date>();
    const lastMessagePreviewMap = new Map<string, string>();
    for (const m of lastInboundMessages) {
      const normalizedPhone = (m._id as string)?.replace(/\D/g, '');
      if (normalizedPhone) {
        lastInboundMap.set(normalizedPhone, new Date(m.lastInboundAt));
        if (m.lastMessagePreview) {
          lastMessagePreviewMap.set(normalizedPhone, m.lastMessagePreview);
        }
      }
    }

    // Marcar los que tienen conversación activa con más datos
    for (const conv of activeConversations) {
      const convPhone = (conv as any).phoneNumber || '';
      const normalizedConvPhone = convPhone.replace(/\D/g, '');
      
      const lastInboundAt = lastInboundMap.get(normalizedConvPhone);
      const lastMessagePreview = lastMessagePreviewMap.get(normalizedConvPhone);
      
      // Calcular si hay nueva actividad: el último mensaje inbound es más reciente que el lastReadAt
      const hasNewActivity = lastInboundAt && (
        !(conv as any).lastReadAt || lastInboundAt > new Date((conv as any).lastReadAt)
      );
      
      // Datos de conversación enriquecidos
      const convData = {
        hasActiveConversation: true,
        conversationId: String(conv._id),
        lifecycleState: conv.lifecycleState,
        owner: conv.owner,
        lastMessageAt: lastInboundAt ? lastInboundAt.toISOString() : conv.lastMessageAt,
        lastReadAt: (conv as any).lastReadAt,
        lastInboundMessageAt: lastInboundAt?.toISOString(),
        lastMessagePreview: lastMessagePreview || null,
        hasNewActivity,
      };
      
      // Buscar en Client
      for (const [cPhone, c] of clientPhoneMap) {
        if (cPhone === normalizedConvPhone || cPhone.includes(normalizedConvPhone) || normalizedConvPhone.includes(cPhone)) {
          Object.assign(c, convData);
          break;
        }
      }
      // Buscar en Lead won
      for (const [lPhone, l] of wonLeadPhoneMap) {
        if (lPhone === normalizedConvPhone || lPhone.includes(normalizedConvPhone) || normalizedConvPhone.includes(lPhone)) {
          Object.assign(l, convData);
          break;
        }
      }
    }

    // ===== 4. UNIFICAR RESULTADO =====
    // Solo Clients + Leads won (Gestión ya no se usa)
    const result: any[] = [];
    
    // Añadir Clients
    for (const c of clientPhoneMap.values()) {
      result.push(c);
    }
    
    // Añadir Leads won
    for (const l of wonLeadPhoneMap.values()) {
      result.push(l);
    }

    // Ordenar: primero los que tienen nueva actividad (mensajes sin leer), luego por última actividad
    result.sort((a, b) => {
      // Si tiene nueva actividad, va primero
      if (a.hasNewActivity && !b.hasNewActivity) return -1;
      if (!a.hasNewActivity && b.hasNewActivity) return 1;
      
      // Si ambos tienen o no tienen nueva actividad, ordenar por última actividad
      const dateA = new Date(a.lastActivityAt || 0).getTime();
      const dateB = new Date(b.lastActivityAt || 0).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('[conversations/customers] error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
