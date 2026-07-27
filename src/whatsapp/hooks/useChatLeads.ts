'use client';

import { useState, useCallback, useEffect } from 'react';
import { api } from '@/lib/api-client';
import type { ChatConversation } from '../types/chat';

interface UseChatLeadsReturn {
  conversations: ChatConversation[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export function useChatLeads(): UseChatLeadsReturn {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[useChatLeads] Fetching conversations...');
      const result = await api.get<{ conversations: ChatConversation[] }>(
        '/api/crm/whatsapp/conversations'
      );
      console.log('[useChatLeads] Got conversations:', result.conversations);
      setConversations(result.conversations);
    } catch (err) {
      console.error('[useChatLeads] Error:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar conversaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const filteredConversations = searchQuery
    ? conversations.filter(
        (c) =>
          c.leadName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.phone.includes(searchQuery)
      )
    : conversations;

  return {
    conversations: filteredConversations,
    loading,
    error,
    refetch: fetchConversations,
    searchQuery,
    setSearchQuery,
  };
}
