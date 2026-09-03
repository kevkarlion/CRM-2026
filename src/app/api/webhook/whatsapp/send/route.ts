import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import whatsappService from '@/crm/services/whatsapp.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, text, leadId } = body;

    if (!to || !text) {
      return NextResponse.json(
        { error: 'Los campos "to" y "text" son requeridos' },
        { status: 400 }
      );
    }

    const tenantId = await whatsappService.getActiveTenantId();

    const result = await whatsappService.sendMessage(tenantId, to, text, leadId);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[WhatsApp Send] Error:', error);
    const message = errorMessage(error, 'Internal Server Error');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
