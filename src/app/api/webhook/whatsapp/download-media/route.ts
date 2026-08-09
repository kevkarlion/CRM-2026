import { NextRequest, NextResponse } from 'next/server';

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
 * 
 * Headers: {
 *   x-tenant-id: string,    // Required
 *   Authorization: string  // Required
 * }
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Verificar autenticación con headers del proyecto
  const tenantId = request.headers.get('x-tenant-id');
  const auth = request.headers.get('Authorization');

  if (!tenantId || !auth) {
    return NextResponse.json(
      { error: 'x-tenant-id and Authorization headers are required' },
      { status: 401 }
    );
  }

  console.log('[download-media] Starting...');

  // Imports - probar primero método alternativo
  let whatsappMediaService: any;
  let whatsappService: any;
  
  try {
    // Método 1: require dinámico (funciona mejor en algunos casos)
    const waMediaModule = await import('@/crm/services/whatsapp-media.service');
    whatsappMediaService = waMediaModule.default || waMediaModule.whatsappMediaService;
    
    const waModule = await import('@/crm/services/whatsapp.service');
    whatsappService = waModule.default || waModule.whatsappService;
    
    console.log('[download-media] Services loaded - waMediaService:', !!whatsappMediaService, 'whatsappService:', !!whatsappService);
  } catch (importErr: any) {
    console.error('[download-media] Import error:', importErr?.message || importErr);
    return NextResponse.json(
      { error: 'Error cargando servicios: ' + (importErr?.message || 'unknown') },
      { status: 500 }
    );
  }

  if (!whatsappMediaService || !whatsappService) {
    console.error('[download-media] Services not loaded properly');
    return NextResponse.json(
      { error: 'Servicios no cargados' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { messageId, filename, clientId: providedClientId, leadId: providedLeadId } = body;

    console.log('[download-media] Request - messageId:', messageId, 'filename:', filename);

    if (!messageId || !filename) {
      return NextResponse.json(
        { error: 'messageId y filename son requeridos' },
        { status: 400 }
      );
    }

    // Buscar el mensaje para obtener el mediaId
    const message = await whatsappService.findMessageById(messageId);
    console.log('[download-media] Message found:', !!message, 'metadata:', message?.metadata);

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

    console.log('[download-media] MediaId:', metadata.mediaId, 'phone:', message.phone);

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
