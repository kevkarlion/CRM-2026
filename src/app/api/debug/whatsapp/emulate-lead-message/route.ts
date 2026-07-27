import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';

/**
 * POST: Simula lead nuevo en un tenant específico
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const { phone, name, message, status = 'new', tenantId } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    }

    const tid = new Types.ObjectId(tenantId);

    // 1. Buscar o crear lead
    let lead = await LeadModel.findOne({ phone, tenantId: tid });

    if (!lead) {
      lead = await LeadModel.create({
        tenantId: tid,
        name: name || `Lead WhatsApp ${phone.slice(-4)}`,
        phone,
        source: 'whatsapp',
        status,
        notes: message ? `Mensaje inicial: ${message}` : 'Creado desde WhatsApp',
        createdBy: 'whatsapp-bot',
        updatedBy: 'whatsapp-bot',
      });
    }

    // 2. Crear mensaje
    const waMessage = await WhatsAppMessageModel.create({
      tenantId: tid,
      phone,
      messageId: `wamid.${Date.now()}`,
      direction: 'inbound',
      type: 'text',
      content: message || 'Hola',
      status: 'delivered',
      leadId: lead._id,
    });

    return NextResponse.json({
      success: true,
      tenantId,
      lead: { _id: String(lead._id), name: lead.name, phone: lead.phone, status: lead.status },
      message: { _id: String(waMessage._id), content: waMessage.content, direction: waMessage.direction }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}