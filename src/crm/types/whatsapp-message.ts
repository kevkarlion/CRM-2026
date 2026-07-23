import { Document, Types } from 'mongoose';

export type WhatsAppMessageDirection = 'inbound' | 'outbound';
export type WhatsAppMessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'interactive' | 'unknown';

export interface IWhatsAppMessage extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  leadId?: Types.ObjectId;
  phone: string;
  messageId: string;
  direction: WhatsAppMessageDirection;
  type: WhatsAppMessageType;
  content: string;
  metadata?: {
    mediaId?: string;
    caption?: string;
    filename?: string;
    fromMe?: boolean;
    waMessageId?: string;
  };
  processedAt?: Date;
  createdAt: Date;
}

export type CreateWhatsAppMessageInput = Omit<
  IWhatsAppMessage,
  keyof Document | '_id' | 'createdAt' | 'processedAt'
>;