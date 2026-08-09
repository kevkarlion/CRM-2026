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

    // Descargar el media desde WhatsApp y subir a Cloudinary SIN crear mensaje nuevo
    const mediaInfo = await whatsappMediaService.getMediaInfo(metadata.mediaId);
    if (!mediaInfo) {
      return NextResponse.json(
        { error: 'No se pudo obtener info del media de WhatsApp' },
        { status: 400 }
      );
    }

    console.log('[download-media] Media info:', mediaInfo);

    const buffer = await whatsappMediaService.downloadMedia(mediaInfo.url);
    if (!buffer) {
      return NextResponse.json(
        { error: 'No se pudo descargar el media de WhatsApp' },
        { status: 400 }
      );
    }

    // Limpiar el nombre del archivo
    const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\.+/g, '.');
    const extension = mediaInfo.mimeType.split('/')[1] || 'bin';
    // Asegurar que siempre tenga extensión
    const hasExtension = cleanFilename.match(/\.[a-zA-Z0-9]+$/);
    const fullFilename = hasExtension ? cleanFilename : cleanFilename + '.' + extension;
    
    console.log('[download-media] filename:', filename, '-> clean:', cleanFilename, '-> full:', fullFilename);

    // Subir a Cloudinary
    const { default: cloudinaryService } = await import('@/core/services/cloudinary.service');
    const resourceType = mediaInfo.mimeType.startsWith('image/') ? 'image' : 
                         mediaInfo.mimeType.startsWith('video/') ? 'video' : 'raw';
    
    const cloudinaryResult = await cloudinaryService.uploadBuffer(
      buffer,
      fullFilename,
      {
        folder: `crm/${tenantId}/whatsapp`,
        resourceType: resourceType as 'image' | 'video' | 'raw',
        publicId: fullFilename, // Mantener extensión en publicId
      }
    );

    console.log('[download-media] Uploaded to Cloudinary:', cloudinaryResult.publicId);

    // Buscar cliente y lead asociados para crear el documento
    let clientId = providedClientId;
    let leadId = providedLeadId;

    if (!clientId) {
      const clientInfo = await whatsappMediaService.findClientByPhone(message.phone);
      clientId = clientInfo?.clientId;
      
      const leadInfo = await whatsappMediaService.findLeadByPhone(message.phone);
      leadId = leadInfo?.leadId;
    }

    console.log('[download-media] Creating document - clientId:', clientId, 'leadId:', leadId);

    // Crear documento en la documentación
    const { default: documentService } = await import('@/documents/services/document.service');
    const documentType = mediaInfo.mimeType.startsWith('image/') ? 'imagen' : 
                        mediaInfo.mimeType === 'application/pdf' ? 'presupuesto' : 'otro';

    const conversationId = await whatsappMediaService.findConversationByPhone(message.phone);

    const doc = await documentService.create({
      tenantId,
      clientId,
      leadId,
      conversationId,
      whatsappMessageId: messageId,
      filename: fullFilename,
      title: fullFilename.replace(/\.[^/.]+$/, ''),
      description: `Recibido por WhatsApp: ${fullFilename}`,
      documentType,
      cloudinaryPublicId: cloudinaryResult.publicId,
      cloudinaryUrl: cloudinaryResult.url,
      secureUrl: cloudinaryResult.secureUrl,
      mimeType: mediaInfo.mimeType,
      fileSize: cloudinaryResult.bytes,
      format: cloudinaryResult.format,
      source: 'whatsapp',
      mediaId: metadata.mediaId,
    });

    console.log('[download-media] Document created:', doc._id);

    // Actualizar el mensaje con la URL de Cloudinary
    await whatsappService.updateMessageMetadata(messageId, {
      pendingDownload: false,
      downloadedAt: new Date(),
      cloudinaryUrl: cloudinaryResult.secureUrl,
      cloudinaryPublicId: cloudinaryResult.publicId,
    });

    console.log('[download-media] Done!');

    return NextResponse.json({
      success: true,
      documentId: doc._id,
      cloudinaryUrl: cloudinaryResult.secureUrl,
      filename: fullFilename,
    });
  } catch (error) {
    console.error('[download-media] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
