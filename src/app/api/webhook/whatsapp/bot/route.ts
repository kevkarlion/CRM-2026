import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { processWhatsAppWebhookMessage } from '@/conversation/infrastructure/webhook-integration';
import { claimInboundMessage, extractWhatsAppMessage } from '@/crm/helpers/whatsapp-message-claim';

/**
 * POST /api/webhook/whatsapp/bot
 *
 * Bot-enabled WhatsApp webhook. Processes incoming messages through the
 * conversation state machine, extracts intent, scores leads, and handles
 * handoffs. Returns 200 OK to Meta always.
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];

    if (!message || !contact) {
      // No message — might be a status update or other event. Acknowledge silently.
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

    const phone = message.from;
    const pushName = contact.profile?.name;
    const messageId = message.id;

    // Extract content based on message type (shared with the main webhook route)
    const { content: messageContent, type: messageType, mediaId, caption, filename } =
      extractWhatsAppMessage(message);

    if (!messageContent) {
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

    // Get tenant — for now use the default; in production derive from phone number config
    const whatsappService = (await import('@/crm/services/whatsapp.service')).default;
    const tenantId = await whatsappService.getActiveTenantId();

    // CLAIM ATOMICO con la misma semántica que la ruta principal (mutex por messageId único).
    // Si la ruta principal ya reclamó/procesó este wamid, el create recibe E11000 y
    // este bot ignora el duplicado: no vuelve a correr el pipeline ni responde dos veces.
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
        console.log(`[Bot Webhook] mensaje duplicado (wamid ${messageId}) ignorado en bot`);
      } else {
        console.error(`[Bot Webhook] no se pudo reclamar el mensaje (wamid ${messageId}) — ignorado`);
      }
      return NextResponse.json({ status: 'ok', duplicate: true }, { status: 200 });
    }

    console.log(`[Bot Webhook] Processing message from ${phone}: "${messageContent}"`);

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

    console.log(`[Bot Webhook] Processed: ${result.actions.length} actions, leadId: ${result.leadId}`);

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('[Bot Webhook] Error:', error);
    // Always return 200 to Meta to prevent retries
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }
}

/**
 * GET — Meta webhook verification
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get('hub.mode') || searchParams.get('hub_mode');
  const token = searchParams.get('hub.verify_token') || searchParams.get('hub_verify_token');
  const challenge = searchParams.get('hub.challenge') || searchParams.get('hub_challenge');

  const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'mi_token_secreto_crm';

  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Verification failed', { status: 403 });
}
