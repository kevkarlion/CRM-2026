import { NextRequest, NextResponse } from 'next/server';
import whatsappService from '@/crm/services/whatsapp.service';
// Importar modelos para asegurar que se registran en Mongoose
import '@/crm/models/whatsapp-message';
import '@/leads/models/lead';
import '@/core/models/tenant';

// Token de verificación para validar la conexión con Meta
const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'mi_token_secreto_crm';

// Token de acceso a la API de WhatsApp Business
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

/**
 * GET: Meta llama a este método para validar tu Webhook cuando lo registras.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Meta puede enviar los parámetros con puntos (hub.mode) o guiones bajos (hub_mode)
  const mode = searchParams.get('hub.mode') || searchParams.get('hub_mode');
  const token = searchParams.get('hub.verify_token') || searchParams.get('hub_verify_token');
  const challenge = searchParams.get('hub.challenge') || searchParams.get('hub_challenge');

  console.log('Webhook verification - mode:', mode, 'token:', token, 'challenge:', challenge);

  // Verifica que el modo y el token coincidan con los configurados en Meta
  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verificado con éxito!');
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Error de verificación', { status: 403 });
}

/**
 * POST: Meta envía a este método todos los mensajes de WhatsApp.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log('📨 Webhook POST recibido - body:', JSON.stringify(body, null, 2));

    // Comprobar si es un evento de WhatsApp Business Account
    if (body.object === 'whatsapp_business_account' || body.object === 'whatsapp') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // Verificar si hay mensajes entrantes
      if (value?.messages && value.messages[0]) {
        const message = value.messages[0];
        const fromNumber = message.from; // Número del cliente
        const messageType = message.type; // 'text', 'image', etc.
        const messageId = message.id; // ID del mensaje de Meta

        console.log(`📩 Mensaje recibido de ${fromNumber}, tipo: ${messageType}, id: ${messageId}`);

        // Procesar según el tipo de mensaje
        let content = '';
        
        if (messageType === 'text') {
          content = message.text.body;
        } else if (messageType === 'interactive') {
          // Botones interactivos
          const buttonReply = message.button?.text || message.list_reply?.title;
          content = buttonReply || 'Interactive message';
        } else if (messageType === 'image') {
          content = message.image?.caption || '[Imagen]';
        } else if (messageType === 'audio') {
          content = '[Audio]';
        } else if (messageType === 'video') {
          content = message.video?.caption || '[Video]';
        } else if (messageType === 'document') {
          content = `[Documento: ${message.document?.filename || 'archivo'}]`;
        }

        console.log(`📝 Contenido: "${content}"`);

        // Obtener el tenant activo
        const tenantId = await whatsappService.getActiveTenantId();

        // Procesar mensaje con el servicio de WhatsApp
        const result = await whatsappService.processIncomingMessage(
          tenantId,
          fromNumber,
          messageId,
          content,
          messageType
        );

        console.log(`✅ Lead ${result.isNewLead ? 'creado' : 'encontrado'}:`, result.lead?._id);

        // Si hay respuesta automática, enviarla
        if (result.shouldRespond && result.responseText) {
          console.log(`📤 Enviando respuesta automática: "${result.responseText}"`);
          await sendWhatsAppMessage(fromNumber, result.responseText);
        }
      }

      // Responder a Meta SIEMPRE con HTTP 200 para confirmar la recepción
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

    console.log('❌ Tipo de evento no soportado:', body.object);
    return NextResponse.json({ error: 'Evento no soportado' }, { status: 404 });
  } catch (error) {
    console.error('Error procesando Webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Envía un mensaje de WhatsApp usando la API de Meta
 */
async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn('⚠️ WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID no configurados');
    return;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: text },
        }),
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error enviando mensaje:', data);
    } else {
      console.log('✅ Mensaje enviado:', data.messages?.[0]?.id);
    }
  } catch (error) {
    console.error('❌ Error en sendWhatsAppMessage:', error);
  }
}