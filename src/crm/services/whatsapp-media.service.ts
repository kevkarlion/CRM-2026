import { Types } from 'mongoose';
import { cloudinaryService } from '@/core/services/cloudinary.service';
import { documentService } from '@/documents/services/document.service';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import LeadModel from '@/leads/models/lead';
import ClientModel from '@/crm/models/client';
import ContactModel from '@/crm/models/contact';
import ConversationModel from '@/conversation/models/conversation';
import connectDB from '@/core/db';
import { normalizePhone, phoneMatchQuery } from '@/lib/phone';

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

export interface WhatsAppMediaInfo {
  id: string;
  mimeType: string;
  fileSize?: number;
  url: string;
}

export interface ProcessMediaResult {
  message: any;
  document?: any;
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
}

/**
 * Servicio desacoplado para manejar multimedia de WhatsApp
 * Sigue el principio de responsabilidad única y es reutilizable
 */
export class WhatsAppMediaService {
  /**
   * Obtiene información del media desde WhatsApp API
   */
  async getMediaInfo(mediaId: string): Promise<WhatsAppMediaInfo | null> {
    if (!WHATSAPP_ACCESS_TOKEN) {
      console.error('[WhatsAppMedia] No hay WHATSAPP_ACCESS_TOKEN configurado');
      return null;
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/v25.0/${mediaId}`,
        {
          headers: {
            'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          },
        }
      );

      if (!response.ok) {
        console.error('[WhatsAppMedia] Error obteniendo info del media:', await response.text());
        return null;
      }

      const data = await response.json();
      
      return {
        id: data.id,
        mimeType: data.mime_type || 'application/octet-stream',
        fileSize: data.file_size,
        url: data.url,
      };
    } catch (error) {
      console.error('[WhatsAppMedia] Error en getMediaInfo:', error);
      return null;
    }
  }

  /**
   * Descarga el archivo desde la URL de WhatsApp
   */
  async downloadMedia(mediaUrl: string): Promise<Buffer | null> {
    if (!WHATSAPP_ACCESS_TOKEN) {
      console.error('[WhatsAppMedia] No hay WHATSAPP_ACCESS_TOKEN configurado');
      return null;
    }

    try {
      const response = await fetch(mediaUrl, {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        },
      });

      if (!response.ok) {
        console.error('[WhatsAppMedia] Error descargando media:', await response.text());
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('[WhatsAppMedia] Error en downloadMedia:', error);
      return null;
    }
  }

  /**
   * Determina el tipo de documento basado en el mimeType
   */
  private getDocumentType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'imagen';
    if (mimeType === 'application/pdf') return 'presupuesto'; // Default para PDFs
    return 'otro';
  }

  /**
   * Determina el tipo de mensaje de WhatsApp
   */
  private getWhatsAppMessageType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }

  /**
   * Encuentra el cliente asociado a un número de teléfono
   */
  async findClientByPhone(phone: string): Promise<{ clientId: string; tenantId: string } | null> {
    await connectDB();
    
    const normalizedPhone = normalizePhone(phone);
    
    // 1. Buscar directamente en Client por teléfono
    const clientByPhone = await ClientModel.findOne({
      phone: phoneMatchQuery(normalizedPhone),
      deletedAt: null,
    }).lean();

    if (clientByPhone) {
      return {
        clientId: String(clientByPhone._id),
        tenantId: String(clientByPhone.tenantId),
      };
    }

    // 2. Buscar en Contactos
    const contact = await ContactModel.findOne({
      phone: phoneMatchQuery(normalizedPhone),
      deletedAt: null,
    }).lean();

    if (contact?.clientId) {
      const client = await ClientModel.findById(contact.clientId).lean();
      if (client) {
        return {
          clientId: String(client._id),
          tenantId: String(client.tenantId),
        };
      }
    }

    // 3. Buscar en Leads (cualquier status, no solo won)
    const lead = await LeadModel.findOne({
      phone: phoneMatchQuery(normalizedPhone),
      deletedAt: null,
    }).lean();

    // Si el lead tiene clientId, usar ese cliente
    if (lead?.clientId) {
      const client = await ClientModel.findById(lead.clientId).lean();
      if (client) {
        return {
          clientId: String(client._id),
          tenantId: String(client.tenantId),
        };
      }
    }

    // 4. Buscar en Leads ganados (por si acaso no tiene clientId)
    const wonLead = await LeadModel.findOne({
      phone: phoneMatchQuery(normalizedPhone),
      status: { $in: ['won', 'qualified'] },
      deletedAt: null,
    }).lean();

    if (wonLead) {
      // Buscar cliente asociado al lead por source
      const client = await ClientModel.findOne({
        tenantId: wonLead.tenantId,
        source: 'lead',
        sourceId: wonLead._id,
        deletedAt: null,
      }).lean();

      if (client) {
        return {
          clientId: String(client._id),
          tenantId: String(client.tenantId),
        };
      }
    }

    return null;
  }

  /**
   * Encuentra el lead asociado a un número de teléfono
   */
  async findLeadByPhone(phone: string): Promise<{ leadId: string; tenantId: string } | null> {
    await connectDB();
    
    const normalizedPhone = normalizePhone(phone);
    
    const lead = await LeadModel.findOne({
      phone: phoneMatchQuery(normalizedPhone),
      deletedAt: null,
    }).lean();

    if (lead) {
      return {
        leadId: String(lead._id),
        tenantId: String(lead.tenantId),
      };
    }

    return null;
  }

  /**
   * Encuentra la conversación activa para un teléfono
   */
  async findConversationByPhone(phone: string): Promise<string | null> {
    await connectDB();
    
    const normalizedPhone = normalizePhone(phone);
    
    const conversation = await ConversationModel.findOne({
      phoneNumber: phoneMatchQuery(normalizedPhone),
      lifecycleState: { $in: ['ACTIVE_LEAD', 'ACTIVE_CLIENT', 'IN_PROGRESS', 'WAITING_OPERATOR'] },
    }).lean();

    return conversation ? String(conversation._id) : null;
  }

  /**
   * Procesa un mensaje multimedia entrante de WhatsApp
   * 1. Obtiene información del media
   * 2. Descarga el archivo
   * 3. Sube a Cloudinary
   * 4. Guarda el mensaje en MongoDB
   * 5. Crea documento asociado si es cliente existente
   */
  async processIncomingMedia(
    tenantId: string,
    phone: string,
    messageId: string,
    mediaId: string,
    caption?: string,
    originalFilename?: string
  ): Promise<ProcessMediaResult | null> {
    
    console.log('[WhatsAppMedia] Procesando media:', { mediaId, phone, messageId });

    // 1. Obtener información del media
    const mediaInfo = await this.getMediaInfo(mediaId);
    if (!mediaInfo) {
      console.error('[WhatsAppMedia] No se pudo obtener información del media');
      return null;
    }

    console.log('[WhatsAppMedia] Media info:', mediaInfo);

    // 2. Descargar el archivo
    const buffer = await this.downloadMedia(mediaInfo.url);
    if (!buffer) {
      console.error('[WhatsAppMedia] No se pudo descargar el media');
      return null;
    }

    // 3. Generar nombre de archivo - usar originalFilename si está disponible, sino caption, sino generar uno
    // El originalFilename es el nombre del archivo que WhatsApp envía
    const extension = mediaInfo.mimeType.split('/')[1] || 'bin';
    
    // Limpiar el nombre del archivo igual que en send-media/route.ts
    const cleanOriginalName = originalFilename?.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\.+/g, '.');
    const cleanCaption = caption?.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\.+/g, '.');
    
    // Usar: originalFilename > caption > generar nombre
    let filename: string;
    if (cleanOriginalName && cleanOriginalName.length > 3) {
      filename = cleanOriginalName;
    } else if (cleanCaption && cleanCaption.length > 3) {
      filename = cleanCaption;
    } else {
      // Generar nombre con extensión correcta
      const timestamp = Date.now();
      filename = `whatsapp_${timestamp}.${extension}`;
    }

    // 4. Subir a Cloudinary
    let cloudinaryResult;
    try {
      const resourceType = mediaInfo.mimeType.startsWith('image/') ? 'image' : 
                           mediaInfo.mimeType.startsWith('video/') ? 'video' : 'raw';
      
      // Mantener extensión en publicId para que Cloudinary guarde correctamente.
      // Prefijar con teléfono + timestamp para garantizar unidad: el nombre
      // original que envía WhatsApp es genérico (ej. IMAG_2.jpeg) y se repite
      // entre usuarios, lo que sobrescribía el asset en Cloudinary y corrompía
      // la imagen mostrada en chats de otros leads/clientes.
      const cleanPublicId = `${normalizePhone(phone)}_${Date.now()}_${filename}`;
      
      cloudinaryResult = await cloudinaryService.uploadBuffer(
        buffer,
        filename,
        {
          folder: `crm/${tenantId}/whatsapp`,
          resourceType: resourceType as 'image' | 'video' | 'raw',
          publicId: cleanPublicId,
        }
      );
    } catch (error) {
      console.error('[WhatsAppMedia] Error subiendo a Cloudinary:', error);
      return null;
    }

    console.log('[WhatsAppMedia] Subido a Cloudinary:', cloudinaryResult.publicId);

    // 5. Determinar el tipo de mensaje de WhatsApp
    const messageType = this.getWhatsAppMessageType(mediaInfo.mimeType);
    
    // 6. Generar contenido para el mensaje
    const content = caption || `[${messageType === 'image' ? 'Imagen' : messageType === 'document' ? 'Documento' : 'Archivo'}]`;

    // 7. Buscar cliente y lead asociados
    const clientInfo = await this.findClientByPhone(phone);
    const leadInfo = await this.findLeadByPhone(phone);
    const conversationId = await this.findConversationByPhone(phone);

    // 8. Guardar mensaje en MongoDB
    const messageData: any = {
      tenantId: new Types.ObjectId(tenantId),
      phone: normalizePhone(phone),
      messageId,
      direction: 'inbound',
      type: messageType,
      content,
      status: 'delivered',
      metadata: {
        mediaId,
        caption: caption || '',
        filename: filename,
        cloudinaryUrl: cloudinaryResult.secureUrl,
        cloudinaryPublicId: cloudinaryResult.publicId,
      },
    };

    if (leadInfo) {
      messageData.leadId = new Types.ObjectId(leadInfo.leadId);
    }

    const message = await WhatsAppMessageModel.create(messageData);

    // 9. Crear documento en la colección de documentos
    let document = null;
    const docTenantId = clientInfo?.tenantId || leadInfo?.tenantId || tenantId;
    const docClientId = clientInfo?.clientId;
    const docLeadId = leadInfo?.leadId;
    const documentType = this.getDocumentType(mediaInfo.mimeType);

    console.log('[WhatsAppMedia] Client info:', clientInfo);
    console.log('[WhatsAppMedia] Lead info:', leadInfo);
    console.log('[WhatsAppMedia] docClientId:', docClientId, 'docLeadId:', docLeadId);

    try {
      // Usar el filename real para el título del documento
      const isGeneratedFilename = filename.startsWith('whatsapp_') && filename.includes('.');
      const docTitle = !isGeneratedFilename
        ? filename.replace(/\.[^/.]+$/, '') // Quitar extensión para el título
        : `${messageType === 'image' ? 'Imagen' : 'Documento'} - ${new Date().toLocaleDateString('es-AR')}`;
      
      console.log('[WhatsAppMedia] Creating document with title:', docTitle, 'clientId:', docClientId);
      
      document = await documentService.create({
        tenantId: docTenantId,
        clientId: docClientId,
        leadId: docLeadId,
        conversationId,
        whatsappMessageId: messageId,
        filename,
        title: docTitle,
        description: `Recibido por WhatsApp${originalFilename ? `: ${originalFilename}` : caption ? `: ${caption}` : ''}`,
        documentType,
        cloudinaryPublicId: cloudinaryResult.publicId,
        cloudinaryUrl: cloudinaryResult.url,
        secureUrl: cloudinaryResult.secureUrl,
        mimeType: mediaInfo.mimeType,
        fileSize: cloudinaryResult.bytes,
        format: cloudinaryResult.format,
        width: cloudinaryResult.width,
        height: cloudinaryResult.height,
        source: 'whatsapp',
        mediaId,
      });
    } catch (docError) {
      console.error('[WhatsAppMedia] Error creando documento:', docError);
      // Continuar aunque falle el documento - el mensaje ya está guardado
    }

    return {
      message,
      document,
      cloudinaryUrl: cloudinaryResult.secureUrl,
      cloudinaryPublicId: cloudinaryResult.publicId,
    };
  }

  /**
   * Envía un mensaje multimedia a WhatsApp
   */
  async sendMediaMessage(
    tenantId: string,
    to: string,
    cloudinaryUrl: string,
    mimeType: string,
    caption?: string,
    leadId?: string,
    clientId?: string,
    filename?: string
  ): Promise<{ message: any; metaResponse: any }> {
    if (!WHATSAPP_ACCESS_TOKEN) {
      throw new Error('WHATSAPP_ACCESS_TOKEN no configurado');
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!phoneNumberId) {
      throw new Error('WHATSAPP_PHONE_NUMBER_ID no configurado');
    }

    const normalizedTo = normalizePhone(to);
    const isImage = mimeType.startsWith('image/');
    const mediaType = isImage ? 'image' : 'document';

    console.log('[WhatsAppMedia] Send media - normalizedTo:', normalizedTo, 'isImage:', isImage);

    // Preparar el mensaje según el tipo
    const messageBody: any = {
      messaging_product: 'whatsapp',
      to: normalizedTo,
      type: mediaType,
      [mediaType]: {
        link: cloudinaryUrl,
      },
    };

    // Para documentos, usar filename para el título; para imágenes, usar caption
    if (!isImage && filename) {
      messageBody.document.filename = filename;
    } else if (caption) {
      if (isImage) {
        messageBody.image.caption = caption;
      } else {
        messageBody.document.caption = caption;
      }
    }

    console.log('[WhatsAppMedia] Enviando media:', { to: normalizedTo, mediaType, mimeType });

    const response = await fetch(
      `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageBody),
      }
    );

    const metaResponse = await response.json();
    
    // Determine if the message was sent successfully
    let messageStatus = 'sent';
    let errorMsg: string | undefined;
    
    if (!response.ok) {
      console.error('[WhatsAppMedia] Error enviando media:', metaResponse);
      messageStatus = 'failed';
      errorMsg = metaResponse.error?.message || 'Error enviando mensaje multimedia';
    }

    const waMessageId = metaResponse.messages?.[0]?.id || `failed_${Date.now()}`;

    // Guardar mensaje saliente (siempre guardamos, incluso si falló)
    const contentText = filename 
      ? `[${isImage ? 'Imagen' : 'Documento'}: ${filename}]`
      : (caption || `[${isImage ? 'Imagen' : 'Documento'} enviado]`);
    
    const messageData: any = {
      tenantId: new Types.ObjectId(tenantId),
      phone: normalizedTo,
      messageId: waMessageId,
      direction: 'outbound',
      type: mediaType,
      content: contentText,
      status: messageStatus,
      errorMessage: errorMsg,
      metadata: {
        mediaId: '',
        caption: caption || '',
        cloudinaryUrl,
        filename: filename || '',
      },
    };

    if (leadId) {
      messageData.leadId = new Types.ObjectId(leadId);
    }
    if (clientId) {
      messageData.clientId = new Types.ObjectId(clientId);
    }

    const message = await WhatsAppMessageModel.create(messageData);

    return { message, metaResponse };
  }
}

export const whatsappMediaService = new WhatsAppMediaService();
export default whatsappMediaService;