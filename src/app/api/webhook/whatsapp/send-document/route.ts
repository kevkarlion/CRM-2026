import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import whatsappMediaService from '@/crm/services/whatsapp-media.service';
import whatsappService from '@/crm/services/whatsapp.service';

/**
 * Envía un documento existente (por URL) via WhatsApp
 * 
 * Ideal para documentos que ya están subidos (ej: presupuestos, remitos)
 * No requiere subir el archivo de nuevo a Cloudinary
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, to, caption, clientId, leadId, mimeType } = body;

    if (!url || !to) {
      return NextResponse.json(
        { error: 'Los campos "url" y "to" son requeridos' },
        { status: 400 }
      );
    }

    console.log('[WhatsApp Send Document] Recibido:', { 
      url: url.substring(0, 50) + '...',
      to,
      caption,
      clientId,
      leadId,
      mimeType
    });

    // Obtener tenant ID
    const tenantId = await whatsappService.getActiveTenantId();

    // Determinar mimeType si no se proporciona
    const fileMimeType = mimeType || 'application/pdf';

    // Enviar via WhatsApp usando la URL existente
    const result = await whatsappMediaService.sendMediaMessage(
      tenantId,
      to,
      url,
      fileMimeType,
      caption || undefined,
      leadId || undefined,
      clientId || undefined,
      undefined // filename - puede extraerse de la URL si es necesario
    );

    console.log('[WhatsApp Send Document] Enviado a WhatsApp:', result.message._id);

    // Ensure serializable response
    const messageDoc = result.message;
    const responseMessage = {
      _id: String(messageDoc._id),
      messageId: messageDoc.messageId,
      phone: messageDoc.phone,
      leadId: messageDoc.leadId ? String(messageDoc.leadId) : undefined,
      direction: messageDoc.direction,
      type: messageDoc.type,
      content: messageDoc.content,
      status: messageDoc.status,
      errorMessage: messageDoc.errorMessage,
      metadata: {
        cloudinaryUrl: url,
      },
      createdAt: messageDoc.createdAt?.toISOString?.() || new Date().toISOString(),
    };

    return NextResponse.json({
      message: responseMessage,
    }, { status: 200 });

  } catch (error) {
    console.error('[WhatsApp Send Document] Error:', error);
    const message = errorMessage(error, 'Internal Server Error');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
