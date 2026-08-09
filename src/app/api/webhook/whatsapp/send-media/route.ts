import { NextRequest, NextResponse } from 'next/server';
import whatsappMediaService from '@/crm/services/whatsapp-media.service';
import whatsappService from '@/crm/services/whatsapp.service';

/**
 * Envía un mensaje multimedia (imagen, documento) via WhatsApp
 * 
 * Flujo:
 * 1. El cliente envía el archivo al endpoint de upload
 * 2. El archivo se sube a Cloudinary
 * 3. Se envía el media via WhatsApp API
 * 4. Se guarda el mensaje en MongoDB
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const to = formData.get('to') as string | null;
    const caption = formData.get('caption') as string | null;
    const leadId = formData.get('leadId') as string | null;
    const clientId = formData.get('clientId') as string | null;

    if (!file || !to) {
      return NextResponse.json(
        { error: 'Los campos "file" y "to" son requeridos' },
        { status: 400 }
      );
    }

    console.log('[WhatsApp Send Media] Recibido:', { 
      filename: file.name, 
      size: file.size, 
      type: file.type,
      to,
      leadId,
      clientId
    });

    // Validar tipo de archivo
    const allowedTypes = [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Tipo de archivo no permitido: ${file.type}` },
        { status: 400 }
      );
    }

    // Validar tamaño (máx 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'El archivo excede el tamaño máximo de 10MB' },
        { status: 400 }
      );
    }

    // Obtener tenant ID
    const tenantId = await whatsappService.getActiveTenantId();

    // Convertir archivo a buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir a Cloudinary
    const { cloudinaryService } = await import('@/core/services/cloudinary.service');
    const resourceType = file.type.startsWith('image/') ? 'image' : 'raw';
    
    // Clean filename - same as DocumentService
    const cleanFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\.+/g, '.');
    
    const cloudinaryResult = await cloudinaryService.uploadBuffer(
      buffer,
      file.name,
      {
        folder: `crm/${tenantId}/whatsapp`,
        resourceType: resourceType as 'image' | 'raw',
        publicId: cleanFilename,
      }
    );

    console.log('[WhatsApp Send Media] Subido a Cloudinary:', cloudinaryResult.publicId);

    // Enviar via WhatsApp
    const result = await whatsappMediaService.sendMediaMessage(
      tenantId,
      to,
      cloudinaryResult.secureUrl,
      file.type,
      caption || undefined,
      leadId || undefined,
      clientId || undefined
    );

    console.log('[WhatsApp Send Media] Enviado a WhatsApp:', result.message._id);
    console.log('[WhatsApp Send Media] Message phone:', result.message.phone);
    console.log('[WhatsApp Send Media] Message status:', result.message.status);

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
        filename: file.name,
        cloudinaryUrl: cloudinaryResult.secureUrl,
        cloudinaryPublicId: cloudinaryResult.publicId,
      },
      createdAt: messageDoc.createdAt?.toISOString?.() || new Date().toISOString(),
    };

    // Always return 200 - the message is saved in DB even if WhatsApp failed
    // Frontend will show it as "failed" if status === 'failed'
    return NextResponse.json({
      message: responseMessage,
      cloudinaryUrl: cloudinaryResult.secureUrl,
      cloudinaryPublicId: cloudinaryResult.publicId,
    }, { status: 200 });

  } catch (error) {
    console.error('[WhatsApp Send Media] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}