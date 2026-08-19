import { NextRequest, NextResponse } from 'next/server';
import whatsappService from '@/crm/services/whatsapp.service';
import whatsappMediaService from '@/crm/services/whatsapp-media.service';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
// Importar modelos para asegurar que se registran en Mongoose
import '@/crm/models/whatsapp-message';
import '@/leads/models/lead';
import '@/core/models/tenant';
import connectDB from '@/core/db';
import { isMaintenanceMode, isMaintenanceBypassPhone, getMaintenanceWhatsAppMessage } from '@/lib/maintenance';

// Token de verificación para validar la conexión con Meta
const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'mi_token_secreto_crm';

// Token de acceso a la API de WhatsApp Business
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

/**
 * GET: Meta llama a este método para validar tu Webhook cuando lo registras.
 * 
 * ESTE ES EL CÓDIGO VIEJO - Salvaguardado el 2026-08-19
 * Ya no se usa - el nuevo flow está en route.ts
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
 * 
 * ESTE ES EL CÓDIGO VIEJO - Salvaguardado el 2026-08-19
 * Ya no se usa - el nuevo flow está en route.ts
 */
export async function POST(req: NextRequest) {
  try {
    // Ensure database connection before any DB operation
    await connectDB();

    const body = await req.json();

    console.log('📨 Webhook POST recibido - body:', JSON.stringify(body, null, 2));

    // Comprobar si es un evento de WhatsApp Business Account
    if (body.object === 'whatsapp_business_account' || body.object === 'whatsapp') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // IGNORAR status updates (delivery receipts) - solo procesar mensajes entrantes
      if (!value?.messages || !value.messages[0]) {
        // Es solo un status update (delivered, sent, read) - ignorar
        console.log('📭 Ignorando status update:', value?.statuses?.[0]?.status);
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      const message = value.messages[0];
      const fromNumber = message.from;
      const messageType = message.type;
      const messageId = message.id;
      
      // Extraer profileName de los contactos
      const profileName = value.contacts?.[0]?.profile?.name;
      if (profileName) {
        console.log(`👤 Profile name: ${profileName}`);
      }

console.log(`📩 Mensaje recibido de ${fromNumber}, tipo: ${messageType}, id: ${messageId}`);

      // Check if message was already processed (prevent duplicates)
      try {
        await connectDB();
        const existingMessage = await WhatsAppMessageModel.findOne({ messageId });
        
        if (existingMessage) {
          console.log(`⏭️ Mensaje ya procesado, ignorando: ${messageId}`);
          return NextResponse.json({ status: 'ok', duplicate: true }, { status: 200 });
        }
      } catch (dupError) {
        console.error('[Webhook] Error checking duplicate:', dupError);
        // Continue processing if duplicate check fails
      }
        
      // Procesar según el tipo de mensaje
      let content = '';
      let mediaId: string | undefined;
      let mediaCaption: string | undefined;
      
      if (messageType === 'text') {
        content = message.text.body;
      } else if (messageType === 'interactive') {
        const buttonReply = message.button?.text || message.list_reply?.title;
        content = buttonReply || 'Interactive message';
      } else if (messageType === 'image') {
        mediaId = message.image?.id;
        mediaCaption = message.image?.caption;
        content = mediaCaption || '[Imagen]';
      } else if (messageType === 'audio') {
        mediaId = message.audio?.id;
        content = '[Audio]';
      } else if (messageType === 'video') {
        mediaId = message.video?.id;
        mediaCaption = message.video?.caption;
        content = mediaCaption || '[Video]';
      } else if (messageType === 'document') {
        mediaId = message.document?.id;
        mediaCaption = message.document?.filename;
        content = `[Documento: ${message.document?.filename || 'archivo'}]`;
        console.log(`[Webhook] Document - id: ${message.document?.id}, filename: ${message.document?.filename}`);
      }

      console.log(`📝 Contenido: "${content}"`);
      console.log(`📎 mediaId después del procesamiento: ${mediaId}, messageType: ${messageType}`);
      if (mediaId) {
        console.log(`📎 Media ID: ${mediaId}, Tipo: ${messageType}`);
      }

      // Obtener el tenant activo
      console.log('[Webhook] Getting tenant ID...');
      const tenantId = await whatsappService.getActiveTenantId();
      console.log('[Webhook] Tenant ID:', tenantId);

      // Check maintenance mode - if active and user doesn't have bypass, return maintenance message
      if (isMaintenanceMode() && !isMaintenanceBypassPhone(fromNumber)) {
        console.log(`[Webhook] 🔧 Maintenance mode active, sending maintenance message to ${fromNumber}`);
        
        // Send maintenance message back
        const maintenanceMessage = getMaintenanceWhatsAppMessage();
        try {
          await whatsappService.sendMessage(tenantId, fromNumber, maintenanceMessage, undefined);
        } catch (sendError) {
          console.error('[Webhook] Error sending maintenance message:', sendError);
        }
        
        return NextResponse.json({ status: 'ok', maintenance: true }, { status: 200 });
      }

      // Ya no procesamos multimedia automáticamente - se maneja desde el chat
      // Solo guardamos los metadatos para mostrar en el chat
      let mediaMetadata = null;
      if (mediaId) {
        mediaMetadata = {
          mediaId,
          caption: mediaCaption || '',
          filename: message.document?.filename || '',
          mimeType: message.document?.mime_type || 
                   (message.image ? 'image/jpeg': 
                    message.video ? 'video/mp4': 
                    message.audio ? 'audio/ogg' : 'application/octet-stream'),
        };
        console.log('[Webhook] Media metadata guardado para chat:', mediaMetadata);
      }

      // Procesar mensaje con el servicio de WhatsApp
      console.log('[Webhook] Calling processIncomingMessage...');
      let result;
      try {
        result = await whatsappService.processIncomingMessage(
          tenantId,
          fromNumber,
          messageId,
          content,
          messageType,
          profileName,
          mediaMetadata  // Pasar metadatos del media
        );
        console.log('[Webhook] processIncomingMessage completed');
      } catch (processError) {
        console.error('[Webhook] ERROR in processIncomingMessage:', processError);
        return NextResponse.json({ status: 'ok', error: 'process error' }, { status: 200 });
      }

      console.log(`✅ Lead ${result.isNewLead ? 'creado' : 'encontrado'}:`, result.lead?._id);

      // Si hay respuesta automática, enviarla
      if (result.shouldRespond && result.responseText) {
        console.log(`📤 Enviando respuesta automática: "${result.responseText}"`);
        await whatsappService.sendMessage(tenantId, fromNumber, result.responseText, result.lead?._id?.toString());
      }

      // Responder a Meta SIEMPRE con HTTP 200
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

    console.log('❌ Tipo de evento no soportado:', body.object);
    return NextResponse.json({ error: 'Evento no soportado' }, { status: 404 });
  } catch (error) {
    console.error('Error procesando Webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
