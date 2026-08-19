import { Document, Types } from 'mongoose';

export type WhatsAppMessageDirection = 'inbound' | 'outbound';
export type WhatsAppMessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'interactive' | 'unknown';
export type WhatsAppMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface IWhatsAppMessage extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  leadId?: Types.ObjectId;
  phone: string;
  messageId: string;
  direction: WhatsAppMessageDirection;
  type: WhatsAppMessageType;
  content: string;
  status: WhatsAppMessageStatus;
  metadata?: {
    mediaId?: string;
    caption?: string;
    filename?: string;
    fromMe?: boolean;
    waMessageId?: string;
    cloudinaryUrl?: string;
    cloudinaryPublicId?: string;
    pendingDownload?: boolean;
    downloadedAt?: Date;
    mimeType?: string;
  };
  errorMessage?: string;
  readAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateWhatsAppMessageInput = Omit<
  IWhatsAppMessage,
  keyof Document | '_id' | 'createdAt' | 'updatedAt' | 'processedAt' | 'readAt' | 'deliveredAt' | 'status'
> & {
  status?: WhatsAppMessageStatus;
};

export interface WhatsAppConversation {
  phone: string;
  leadId?: Types.ObjectId;
  leadName?: string;
  lastMessage: {
    content: string;
    direction: WhatsAppMessageDirection;
    type: WhatsAppMessageType;
    createdAt: Date;
  };
  unreadCount: number;
  totalMessages: number;
  lastActivity: Date;
}