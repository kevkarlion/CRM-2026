'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api-client';
import type { ChatMessage, SendMessageInput } from '../types/chat';

interface SendMediaInput {
  file: File;
  to: string;
  caption?: string;
  leadId?: string;
  clientId?: string;
}

interface DownloadMediaInput {
  messageId: string;
  filename: string;
  clientId?: string;
  leadId?: string;
}

interface UseWhatsAppSendReturn {
  sendMessage: (input: SendMessageInput) => Promise<ChatMessage | null>;
  sendMedia: (input: SendMediaInput) => Promise<ChatMessage | null>;
  downloadMedia: (input: DownloadMediaInput) => Promise<{ success: boolean; cloudinaryUrl?: string; error?: string }>;
  sending: boolean;
  error: string | null;
}

export function useWhatsAppSend(): UseWhatsAppSendReturn {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (input: SendMessageInput): Promise<ChatMessage | null> => {
    try {
      setSending(true);
      setError(null);

      const result = await api.post<{ message: ChatMessage }>(
        '/api/crm/whatsapp/messages',
        input
      );

      return result.message;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al enviar mensaje';
      setError(msg);
      return null;
    } finally {
      setSending(false);
    }
  }, []);

  const sendMedia = useCallback(async (input: SendMediaInput): Promise<ChatMessage | null> => {
    try {
      setSending(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', input.file);
      formData.append('to', input.to);
      if (input.caption) formData.append('caption', input.caption);
      if (input.leadId) formData.append('leadId', input.leadId);
      if (input.clientId) formData.append('clientId', input.clientId);

      const result = await api.post<{ message: ChatMessage }>(
        '/api/webhook/whatsapp/send-media',
        formData,
        true // isFormData
      );

      return result.message;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al enviar archivo';
      setError(msg);
      return null;
    } finally {
      setSending(false);
    }
  }, []);

  const downloadMedia = useCallback(async (input: DownloadMediaInput): Promise<{ success: boolean; cloudinaryUrl?: string; error?: string }> => {
    try {
      setSending(true);
      setError(null);

      const result = await api.post<{ success: boolean; cloudinaryUrl?: string; error?: string }>(
        '/api/webhook/whatsapp/download-media',
        input
      );

      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al descargar archivo';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setSending(false);
    }
  }, []);

  return { sendMessage, sendMedia, downloadMedia, sending, error };
}
