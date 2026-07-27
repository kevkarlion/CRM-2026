'use client';

import { useState, useCallback, useEffect } from 'react';
import { api } from '@/lib/api-client';
import type { ChatMessage } from '../types/chat';

interface UseChatMessagesReturn {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  refetch: () => Promise<void>;
}

export function useChatMessages(phone: string | null): UseChatMessagesReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchMessages = useCallback(async (before?: string) => {
    if (!phone) return;

    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string> = { limit: '50' };
      if (before) params.before = before;

      const result = await api.get<{ messages: ChatMessage[] }>(
        `/api/crm/whatsapp/conversations/${encodeURIComponent(phone)}/messages`,
        params
      );

      if (before) {
        setMessages((prev) => [...result.messages, ...prev]);
      } else {
        setMessages(result.messages);
      }

      setHasMore(result.messages.length === 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar mensajes');
    } finally {
      setLoading(false);
    }
  }, [phone]);

  // Fetch on phone change
  useEffect(() => {
    if (phone) {
      setMessages([]); // Clear previous messages
      fetchMessages();
    }
  }, [phone, fetchMessages]);

  const loadMore = useCallback(async () => {
    if (messages.length === 0) return;
    const oldest = messages[0];
    await fetchMessages(oldest.createdAt);
  }, [messages, fetchMessages]);

  const refetch = useCallback(() => fetchMessages(), [fetchMessages]);

  return { messages, loading, error, loadMore, hasMore, refetch };
}
