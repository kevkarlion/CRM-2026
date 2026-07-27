import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { processWhatsAppWebhookMessage } from '@/conversation/infrastructure/webhook-integration';

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

    // Extract content based on message type
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

    // Get tenant — for now use the default; in production derive from phone number config
    const whatsappService = (await import('@/crm/services/whatsapp.service')).default;
    const tenantId = await whatsappService.getActiveTenantId();

    console.log(`[Bot Webhook] Processing message from ${phone}: "${messageContent}"`);

    const result = await processWhatsAppWebhookMessage({
      tenantId,
      phone,
      messageContent,
      pushName,
      messageId,
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
