import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';

/**
 * POST: Simula un mensaje entrante de WhatsApp
 * Crea el lead si no existe + mensaje en WhatsAppMessage
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const { phone, name, message } = body;

    const tenantId = '000000000000000000000001';

    // 1. Buscar o crear lead
    let lead = await LeadModel.findOne({ 
      phone, 
      tenantId: new Types.ObjectId(tenantId) 
    });

    if (!lead) {
      lead = await LeadModel.create({
        tenantId: new Types.ObjectId(tenantId),
        name: name || `Lead ${phone.slice(-4)}`,
        phone,
        source: 'whatsapp',
        status: 'new',
        notes: `Lead creado desde WhatsApp: ${message}`,
        createdBy: 'system',
        updatedBy: 'system',
      });
    }

    // 2. Crear mensaje
    const waMessage = await WhatsAppMessageModel.create({
      tenantId: new Types.ObjectId(tenantId),
      phone,
      messageId: `wamid.${Date.now()}`,
      direction: 'inbound',
      type: 'text',
      content: message,
      status: 'delivered',
      leadId: lead._id,
    });

    // 3. Responder con lo creado
    return NextResponse.json({
      success: true,
      lead: {
        _id: String(lead._id),
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
      },
      message: {
        _id: String(waMessage._id),
        content: waMessage.content,
        direction: waMessage.direction,
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}