import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import whatsappService from '@/crm/services/whatsapp.service';

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const { phone, name, message } = body;

    console.log('=== Debug: Simulating incoming WhatsApp message ===');
    console.log({ phone, name, message });

    // Simular el flujo completo del webhook
    // Usar tenant fijo para testing
    const tenantId = '000000000000000000000001';
    console.log('Tenant ID:', tenantId);

    const result = await whatsappService.processIncomingMessage(
      tenantId,
      phone,
      `wamid.debug.${Date.now()}`,
      message || 'Hola',
      'text'
    );

    console.log('Result:', {
      isNewLead: result.isNewLead,
      leadId: result.lead?._id,
      leadName: result.lead?.name,
      shouldRespond: result.shouldRespond,
      responseText: result.responseText,
    });

    // Enviar respuesta automática solo si no es test (skip en dev)
    // if (result.shouldRespond && result.responseText) {
    //   await whatsappService.sendMessage(
    //     tenantId,
    //     phone,
    //     result.responseText,
    //     result.lead?._id?.toString()
    //   );
    // }

    return NextResponse.json({
      success: true,
      isNewLead: result.isNewLead,
      lead: result.lead ? {
        _id: String(result.lead._id),
        name: result.lead.name,
        phone: result.lead.phone,
        status: result.lead.status,
      } : null,
      message: {
        _id: String(result.message._id),
        content: result.message.content,
        direction: result.message.direction,
      },
      bot: {
        shouldRespond: result.shouldRespond,
        responseText: result.responseText,
      }
    });
  } catch (error) {
    console.error('Error in debug bot flow:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error', stack: error instanceof Error ? error.stack : null },
      { status: 500 }
    );
  }
}