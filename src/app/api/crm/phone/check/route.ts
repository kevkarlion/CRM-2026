import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';
import ClientModel from '@/crm/models/client';
import { normalizePhone, phoneMatchQuery, isActiveClient, type PhoneCollisionWarning } from '@/lib/phone';

/**
 * GET /api/crm/phone/check?phone=...
 * 
 * Verifica si un teléfono ya existe en leads o clientes activos.
 * Retorna lista deCollisiones encontradas.
 * 
 * Datos canónicos: la lógica de detección vive aquí, el front solo muestra.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    const excludeId = searchParams.get('exclude'); // para ignore en edición

    if (!phone) {
      return NextResponse.json({ error: 'phone required' }, { status: 400 });
    }

    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id required' }, { status: 401 });
    }

    await connectDB();

    const normalizedPhone = normalizePhone(phone);
    const query = phoneMatchQuery(normalizedPhone);

    // Buscar leads activos que coincidan
    const leads = await LeadModel.find({
      tenantId: { $in: [new (await import('mongoose')).Types.ObjectId(tenantId), tenantId] },
      phone: query,
      deletedAt: null,
    }).select('_id name status phone').lean();

    // Buscar clientes activos que coincidan
    const clients = await ClientModel.find({
      tenantId: { $in: [new (await import('mongoose')).Types.ObjectId(tenantId), tenantId] },
      phone: query,
      deletedAt: null,
    }).select('_id name status phone').lean();

    // Filtrar leads (todos, no solo activos - para detectar duplicados)
    const collisions: PhoneCollisionWarning[] = [];

    for (const lead of leads) {
      // Excluir si es el mismo ID (para modo edición)
      if (excludeId && String(lead._id) === excludeId) continue;
      
      // Mostrar todos los leads, sin importar su status (para detectar duplicados)
      collisions.push({
        type: 'lead',
        id: String(lead._id),
        name: lead.name,
        status: lead.status,
      });
    }

    // Filtrar clientes activos nomás (los no activos no son relevantes)
    for (const client of clients) {
      if (excludeId && String(client._id) === excludeId) continue;
      
      if (isActiveClient(client)) {
        collisions.push({
          type: 'client',
          id: String(client._id),
          name: (client as any).fullName || (client as any).name || 'Cliente',
          status: client.status || 'active',
        });
      }
    }

    return NextResponse.json({ collisions });
  } catch (error) {
    console.error('[phone/check] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}