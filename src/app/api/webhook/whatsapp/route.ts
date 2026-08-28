import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { processWhatsAppWebhookMessage } from '@/conversation/infrastructure/webhook-integration';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import { isMaintenanceMode, isMaintenanceBypassPhone, getMaintenanceWhatsAppMessage } from '@/lib/maintenance';
import whatsappService from '@/crm/services/whatsapp.service';
import ConversationModel from '@/conversation/models/conversation';
import { claimInboundMessage, extractWhatsAppMessage } from '@/crm/helpers/whatsapp-message-claim';
import { Types } from 'mongoose';

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

      // ✅ PROCESAR status updates (delivery receipts) - Double Check
      if (value?.statuses && value.statuses.length > 0) {
        console.log('📭 Processing status update:', JSON.stringify(value.statuses));
        
        for (const statusUpdate of value.statuses) {
          const waMessageId = statusUpdate.id;
          const waStatus = statusUpdate.status;
          
          console.log(`[StatusUpdate] messageId: ${waMessageId}, status: ${waStatus}`);
          
          // Find the message in our DB
          const message = await WhatsAppMessageModel.findOne({ messageId: waMessageId });
          
          if (!message) {
            console.log(`[StatusUpdate] Message not found in DB: ${waMessageId}, ignoring`);
            continue;
          }
          
          // Map WhatsApp status to our status
          let newStatus: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' = 'sent';
          const updateFields: Record<string, unknown> = {};
          
          if (waStatus === 'sent') {
            newStatus = 'sent';
          } else if (waStatus === 'delivered') {
            newStatus = 'delivered';
            updateFields.deliveredAt = new Date();
          } else if (waStatus === 'read') {
            newStatus = 'read';
            updateFields.readAt = new Date();
          } else if (waStatus === 'failed') {
            newStatus = 'failed';
            updateFields.failedAt = new Date();
            updateFields.errorMessage = statusUpdate.errors?.[0]?.description || 'Send failed';
          }
          
          // Idempotent: only update if moving forward
          const statusOrder = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 4 };
          const currentOrder = statusOrder[message.status as keyof typeof statusOrder] || 0;
          const newOrder = statusOrder[newStatus] || 0;
          
          if (newOrder >= currentOrder) {
            updateFields.status = newStatus;
            await WhatsAppMessageModel.updateOne(
              { _id: message._id },
              { $set: updateFields }
            );
            console.log(`[StatusUpdate] Updated ${waMessageId}: ${message.status} → ${newStatus}`);
          } else {
            console.log(`[StatusUpdate] Skipping ${waMessageId}: already at ${message.status}, ignoring ${waStatus}`);
          }
        }
        
        return NextResponse.json({ status: 'ok' }, { status: 200 });
      }

      // New message - continue with existing logic
      if (!value?.messages || !value.messages[0]) {
        console.log('📭 No messages or statuses found');
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

      // Extraer contenido según tipo de mensaje (lógica compartida con la ruta bot)
      const { content: messageContent, type: messageType, mediaId, caption, filename } =
        extractWhatsAppMessage(message);

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

      // CLAIM ATOMICO: el row de WhatsAppMessage por messageId (único) actúa como
      // mutex. Solo una invocación puede insertarlo; la perdedora (E11000) recibe
      // un 200 sin procesar, antes de cualquier findOrCreateEntity.
      const claim = await claimInboundMessage({
        tenantId,
        phone,
        messageId,
        content: messageContent,
        type: messageType,
        mediaId,
        caption,
        filename,
      });

      if (!claim.claimed) {
        if (claim.reason === 'duplicate') {
          console.log(`[webhook] mensaje duplicado (wamid ${messageId}) ignorado`);
        } else {
          console.error(`[webhook] no se pudo reclamar el mensaje (wamid ${messageId}) — ignorado`);
        }
        return NextResponse.json({ status: 'ok', duplicate: true }, { status: 200 });
      }

      // IMPORTANTE: Verificar si hay una conversación con owner: OPERATOR antes de procesar
      // Buscar usando el phone original o los últimos 10 dígitos
      const normalizedPhone = phone.replace(/\D/g, '');
      const phoneLast10 = normalizedPhone.slice(-10);
      
      // Buscar por phone que termine en los últimos 10 dígitos
      const activeConv = await ConversationModel.findOne({
        tenantId: new Types.ObjectId(tenantId),
        $or: [
          { phoneNumber: { $regex: phoneLast10 } },
          { phoneNumber: { $regex: normalizedPhone } },
          { phoneNumber: phone },
        ],
        state: { $nin: ['closed', 'timeout'] },
      }).sort({ lastMessageAt: -1 });
      
      console.log(`[Webhook] Debug - phone: ${phone}, normalized: ${normalizedPhone}, last10: ${phoneLast10}, conv: ${activeConv?._id}, owner: ${activeConv?.owner}, state: ${activeConv?.state}`);

      // Procesar con el nuevo bot flow
      const result = await processWhatsAppWebhookMessage({
        tenantId,
        phone,
        messageContent,
        pushName,
        messageId,
        messageType,
        mediaId,
        caption,
        filename,
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
