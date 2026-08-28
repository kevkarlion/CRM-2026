import { Types } from 'mongoose';
import WhatsAppMessageModel from '@/crm/models/whatsapp-message';
import type { WhatsAppMessageType } from '@/crm/types/whatsapp-message';

/**
 * Detecta un error de clave duplicada (código 11000) de MongoDB.
 * Se complementa con 11001 (DuplicateKey en updates con upsert).
 */
export function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeMongoError = error as { code?: unknown; name?: unknown };
  return (
    maybeMongoError.code === 11000 ||
    maybeMongoError.code === 11001 ||
    maybeMongoError.name === 'MongoServerError' ||
    maybeMongoError.name === 'MongoBulkWriteError'
  );
}

export interface ExtractedWhatsAppMessage {
  content: string;
  type: WhatsAppMessageType;
  mediaId?: string;
  caption?: string;
  filename?: string;
}

/**
 * Extrae contenido y metadatos de un mensaje entrante de WhatsApp.
 * Compartido por la ruta principal y la ruta bot para que el row de claim
 * del mismo wamid sea idéntico sin importar qué ruta gana el claim.
 */
export function extractWhatsAppMessage(message: {
  type?: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  list_reply?: { title?: string; id?: string };
  image?: { caption?: string; id?: string };
  audio?: { id?: string };
  video?: { caption?: string; id?: string };
  document?: { caption?: string; id?: string; filename?: string };
}): ExtractedWhatsAppMessage {
  if (message.type === 'text') {
    return { content: message.text?.body || '', type: 'text' };
  }
  if (message.type === 'interactive') {
    return {
      content:
        message.button?.text ||
        message.list_reply?.title ||
        message.button?.payload ||
        message.list_reply?.id ||
        '',
      type: 'interactive',
    };
  }
  if (message.type === 'image') {
    return {
      content: message.image?.caption || '[Imagen]',
      type: 'image',
      mediaId: message.image?.id,
      caption: message.image?.caption,
    };
  }
  if (message.type === 'audio') {
    return { content: '[Audio]', type: 'audio', mediaId: message.audio?.id };
  }
  if (message.type === 'video') {
    return {
      content: message.video?.caption || '[Video]',
      type: 'video',
      mediaId: message.video?.id,
      caption: message.video?.caption,
    };
  }
  if (message.type === 'document') {
    return {
      content: `[Documento: ${message.document?.filename || 'archivo'}]`,
      type: 'document',
      mediaId: message.document?.id,
      filename: message.document?.filename,
    };
  }
  return { content: '', type: 'unknown' };
}

export interface InboundMessageClaimInput {
  tenantId: string;
  phone: string;
  messageId: string;
  content?: string;
  type?: WhatsAppMessageType;
  mediaId?: string;
  caption?: string;
  filename?: string;
}

/**
 * Construye el documento base de un mensaje entrante SIN leadId/clientId.
 * Se usa tanto para el claim atómico como para el $set posterior
 * (saveInboundMessage) que recién agrega leadId/clientId.
 */
export function buildInboundMessageClaimDoc(input: InboundMessageClaimInput): {
  tenantId: Types.ObjectId;
  phone: string;
  messageId: string;
  direction: 'inbound';
  type: WhatsAppMessageType;
  content: string;
  status: 'delivered';
  metadata?: { mediaId?: string; caption?: string; filename?: string };
} {
  const metadata =
    input.mediaId || input.caption || input.filename
      ? {
          mediaId: input.mediaId,
          caption: input.caption,
          filename: input.filename,
        }
      : undefined;

  return {
    tenantId: new Types.ObjectId(input.tenantId),
    phone: input.phone,
    messageId: input.messageId,
    direction: 'inbound',
    type: input.type || 'text',
    content: input.content ?? '',
    status: 'delivered',
    metadata,
  };
}

export type ClaimInboundMessageResult =
  | { claimed: true }
  | { claimed: false; reason: 'duplicate' }
  | { claimed: false; reason: 'error' };

/**
 * Claim atómico del mensaje entrante: inserta el row por messageId (único).
 * Solo una invocación puede ganar; la perdedora recibe E11000 y debe
 * ignorar el mensaje sin volver a procesar (mutex del webhook).
 */
export async function claimInboundMessage(
  input: InboundMessageClaimInput
): Promise<ClaimInboundMessageResult> {
  try {
    await WhatsAppMessageModel.create(buildInboundMessageClaimDoc(input));
    return { claimed: true };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { claimed: false, reason: 'duplicate' };
    }
    console.error('[claimInboundMessage] Error reclamando mensaje:', error);
    return { claimed: false, reason: 'error' };
  }
}