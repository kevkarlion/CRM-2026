'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api-client';
import type { ChatMessage, SendMessageInput } from '../types/chat';

interface UseWhatsAppSendReturn {
  sendMessage: (input: SendMessageInput) => Promise<ChatMessage | null>;
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

  return { sendMessage, sending, error };
}
