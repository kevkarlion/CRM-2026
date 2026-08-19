import type { Types } from 'mongoose';

export interface ChatLead {
  _id: string;
  name: string;
  phone?: string;
  companyName?: string;
  email?: string;
  status: string;
  temperature?: 'hot' | 'warm' | 'cold';
  estimatedValue?: number;
  assignedTo?: { _id: string; name: string } | string;
  createdAt: string;
}

export interface ChatMessage {
  _id: string;
  phone: string;
  leadId?: string;
  messageId: string;
  direction: 'inbound' | 'outbound';
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'interactive' | 'unknown';
  content: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  metadata?: {
    mediaId?: string;
    caption?: string;
    filename?: string;
    fromMe?: boolean;
    waMessageId?: string;
    cloudinaryUrl?: string;
    cloudinaryPublicId?: string;
    pendingDownload?: boolean;
    downloadedAt?: string;
    mimeType?: string;
  };
  errorMessage?: string;
  readAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  createdAt: string;
}

export interface ChatConversation {
  phone: string;
  leadId?: string;
  leadName?: string;
  lastMessage: {
    content: string;
    direction: 'inbound' | 'outbound';
    type: string;
    createdAt: string;
  };
  unreadCount: number;
  totalMessages: number;
  lastActivity: string;
}

export interface ConversationsResponse {
  conversations: ChatConversation[];
}

export interface MessagesResponse {
  messages: ChatMessage[];
}

export interface SendMessageInput {
  phone: string;
  content: string;
  leadId?: string;
}

export interface SendMessageResponse {
  message: ChatMessage;
}

export type ChatPanelView = 'lead-list' | 'chat' | 'lead-data';
