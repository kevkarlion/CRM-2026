import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import LeadModel from '@/leads/models/lead';
import { Types } from 'mongoose';

/**
 * Simula el flujo completo: lead escribe → bot responde → todo guardado
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const { phone, name, message, tenantId } = body;

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
        status: 'new',
        notes: message ? `Mensaje inicial: ${message}` : 'Creado desde WhatsApp',
        createdBy: 'whatsapp-bot',
        updatedBy: 'whatsapp-bot',
      });
    }

    // 2. Guardar mensaje entrante del lead
    const inboundMessage = await WhatsAppMessageModel.create({
      tenantId: tid,
      phone,
      messageId: `wamid.in.${Date.now()}`,
      direction: 'inbound',
      type: 'text',
      content: message || 'Hola',
      status: 'delivered',
      leadId: lead._id,
    });

    // 3. Simular respuesta del bot
    let botResponse = '';
    const lowerMsg = (message || '').toLowerCase();
    
    if (['hola', 'hello', 'hi', 'buenas'].some(w => lowerMsg.includes(w))) {
      botResponse = '¡Hola! 👋 Bienvenido a Patagonia. Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?\n\n1️⃣ Reparación\n2️⃣ Mantenimiento\n3️⃣ Proyecto nuevo';
    } else if (lowerMsg.includes('reparación') || lowerMsg.includes('reparacion') || lowerMsg === '1') {
      botResponse = 'Perfecto, tenemos servicio de reparación. ¿De qué equipo es? (aire acondicionado, caldera, otro)';
    } else if (lowerMsg.includes('mantenimiento') || lowerMsg === '2') {
      botResponse = '¡Excelente! El mantenimiento preventivo es clave. ¿Cuántos equipos necesitas mantener?';
    } else if (lowerMsg.includes('proyecto') || lowerMsg === '3') {
      botResponse = 'Para proyectos nuevos necesitamos hacer una evaluación en sitio. ¿Cuál es la superficie a climatizar?';
    } else {
      botResponse = 'Gracias por tu mensaje. Un asesor te contactará pronto para darte más información.';
    }

    // 4. Guardar mensaje saliente del bot
    const outboundMessage = await WhatsAppMessageModel.create({
      tenantId: tid,
      phone,
      messageId: `wamid.out.${Date.now()}`,
      direction: 'outbound',
      type: 'text',
      content: botResponse,
      status: 'sent',
      leadId: lead._id,
    });

    return NextResponse.json({
      success: true,
      lead: { _id: String(lead._id), name: lead.name, status: lead.status },
      inbound: { _id: String(inboundMessage._id), content: inboundMessage.content, direction: inboundMessage.direction },
      outbound: { _id: String(outboundMessage._id), content: outboundMessage.content, direction: outboundMessage.direction }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}