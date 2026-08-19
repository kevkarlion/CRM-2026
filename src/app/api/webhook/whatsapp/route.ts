import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { processWhatsAppWebhookMessage } from '@/conversation/infrastructure/webhook-integration';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import { isMaintenanceMode, isMaintenanceBypassPhone, getMaintenanceWhatsAppMessage } from '@/lib/maintenance';
import whatsappService from '@/crm/services/whatsapp.service';

// Token de verificación para validar la conexión con Meta
const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'mi_token_secreto_crm';

/**
 * GET: Meta llama a este método para validar tu Webhook cuando lo registras.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get('hub.mode') || searchParams.get('hub_mode');
  const token = searchParams.get('hub.verify_token') || searchParams.get('hub_verify_token');
  const challenge = searchParams.get('hub.challenge') || searchParams.get('hub_challenge');

  console.log('Webhook verification - mode:', mode, 'token:', token, 'challenge:', challenge);

  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verificado con éxito!');
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Error de verificación', { status: 403 });
}

/**
 * POST: Meta envía a este método todos los mensajes de WhatsApp.
 * 
 * Usa el nuevo flow de bot con state machine y 7 ramas.
 * El código viejo está salvaguardado en: /api/webhook/whatsapp/OLD-route.ts
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();

    console.log('📨 Webhook POST recibido - body:', JSON.stringify(body, null, 2));

    if (body.object === 'whatsapp_business_account' || body.object === 'whatsapp') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // IGNORAR status updates (delivery receipts)
      if (!value?.messages || !value.messages[0]) {
        console.log('📭 Ignorando status update:', value?.statuses?.[0]?.status);
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      const message = value.messages[0];
      const contact = value.contacts?.[0];

      if (!message || !contact) {
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      const phone = message.from;
      const pushName = contact.profile?.name;
      const messageId = message.id;

      // Check if message was already processed (prevent duplicates)
      try {
        const existingMessage = await WhatsAppMessageModel.findOne({ messageId });
        
        if (existingMessage) {
          console.log(`⏭️ Mensaje ya procesado, ignorando: ${messageId}`);
          return NextResponse.json({ status: 'ok', duplicate: true }, { status: 200 });
        }
      } catch (dupError) {
        console.error('[Webhook] Error checking duplicate:', dupError);
      }

      // Extraer contenido según tipo de mensaje
      let messageContent = '';

      if (message.type === 'text') {
        messageContent = message.text?.body || '';
      } else if (message.type === 'interactive') {
        messageContent =
          message.button?.text ||
          message.list_reply?.title ||
          message.button?.payload ||
          message.list_reply?.id ||
          '';
      } else if (message.type === 'image') {
        messageContent = message.image?.caption || '[Imagen]';
      } else if (message.type === 'audio') {
        messageContent = '[Audio]';
      } else if (message.type === 'video') {
        messageContent = message.video?.caption || '[Video]';
      } else if (message.type === 'document') {
        messageContent = `[Documento: ${message.document?.filename || 'archivo'}]`;
      }

      if (!messageContent) {
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      // Check maintenance mode
      if (isMaintenanceMode() && !isMaintenanceBypassPhone(phone)) {
        console.log(`[Webhook] 🔧 Maintenance mode active, sending maintenance message to ${phone}`);
        
        const maintenanceMessage = getMaintenanceWhatsAppMessage();
        try {
          const tenantId = await whatsappService.getActiveTenantId();
          await whatsappService.sendMessage(tenantId, phone, maintenanceMessage, undefined);
        } catch (sendError) {
          console.error('[Webhook] Error sending maintenance message:', sendError);
        }
        
        return NextResponse.json({ status: 'ok', maintenance: true }, { status: 200 });
      }

      // Get tenant
      const tenantId = await whatsappService.getActiveTenantId();

      console.log(`[Webhook] Processing message from ${phone}: "${messageContent}"`);

      // Procesar con el nuevo bot flow
      const result = await processWhatsAppWebhookMessage({
        tenantId,
        phone,
        messageContent,
        pushName,
        messageId,
      });

      console.log(`[Webhook] Processed: ${result.actions.length} actions, leadId: ${result.leadId}`);

      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

    console.log('❌ Tipo de evento no soportado:', body.object);
    return NextResponse.json({ error: 'Evento no soportado' }, { status: 404 });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json({ status: 'ok' }, { status: 200 }); // Always return 200 to Meta
  }
}
