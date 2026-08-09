import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/webhook/whatsapp/download-media
 * Descarga un archivo multimedia de WhatsApp y lo guarda en documentación del cliente
 * 
 * Body: {
 *   messageId: string,      // ID del mensaje de WhatsApp
 *   filename: string,       // Nombre con el que guardar el archivo
 *   clientId?: string,      // ID del cliente (opcional, se busca automáticamente)
 *   leadId?: string         // ID del lead (opcional)
 * }
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Imports dinámicos para evitar errores de fs en Turbopack
  const { default: whatsappMediaService } = await import('@/crm/services/whatsapp-media.service');
  const { default: whatsappService } = await import('@/crm/services/whatsapp.service');
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { messageId, filename, clientId: providedClientId, leadId: providedLeadId } = body;

    if (!messageId || !filename) {
      return NextResponse.json(
        { error: 'messageId y filename son requeridos' },
        { status: 400 }
      );
    }

    // Obtener el tenant del usuario
    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 400 }
      );
    }

    // Buscar el mensaje para obtener el mediaId
    const message = await whatsappService.findMessageById(messageId);
    if (!message) {
      return NextResponse.json(
        { error: 'Mensaje no encontrado' },
        { status: 404 }
      );
    }

    const metadata = message.metadata as any;
    if (!metadata?.mediaId) {
      return NextResponse.json(
        { error: 'El mensaje no tiene multimedia asociado' },
        { status: 400 }
      );
    }

    // Si no se proporciona clientId, buscar por teléfono
    let clientId = providedClientId;
    let leadId = providedLeadId;

    if (!clientId) {
      const clientInfo = await whatsappMediaService.findClientByPhone(message.phone);
      clientId = clientInfo?.clientId;
      
      const leadInfo = await whatsappMediaService.findLeadByPhone(message.phone);
      leadId = leadInfo?.leadId;
    }

    // Descargar y guardar en documentación
    const result = await whatsappMediaService.processIncomingMedia(
      tenantId,
      message.phone,
      messageId,
      metadata.mediaId,
      metadata.caption,
      filename
    );

    if (!result) {
      return NextResponse.json(
        { error: 'Error al procesar el archivo' },
        { status: 500 }
      );
    }

    // Actualizar el mensaje para marcar como descargado
    await whatsappService.updateMessageMetadata(messageId, {
      pendingDownload: false,
      downloadedAt: new Date(),
      cloudinaryUrl: result.cloudinaryUrl,
      cloudinaryPublicId: result.cloudinaryPublicId,
    });

    return NextResponse.json({
      success: true,
      documentId: result.document?._id,
      cloudinaryUrl: result.cloudinaryUrl,
      filename,
    });
  } catch (error) {
    console.error('[download-media] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
