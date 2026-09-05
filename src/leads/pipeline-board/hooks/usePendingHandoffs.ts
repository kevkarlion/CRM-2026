'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

export interface HandoffInfo {
  conversationId: string;
  leadId: string;
  leadName: string;
  phone?: string;
  handoffReason: string;
  handoffStatus: string;
  score?: number;
  temperature?: string;
  lastMessageAt: Date;
  state: string;
}

interface ConversationWithLead {
  _id: string;
  leadId: string;
  state: string;
  handoffStatus?: string;
  handoffReason?: string;
  lastMessageAt: Date;
  lead: {
    _id: string;
    name: string;
    phone?: string;
    score?: number;
    temperature?: string;
  } | null;
}

interface UsePendingHandoffsOptions {
  /** When false, the hook fetches once but does NOT schedule its own interval,
   *  letting an external polling trigger own the cadence. @default true */
  pollEnabled?: boolean;
}

interface UsePendingHandoffsReturn {
  count: number;
  handoffs: HandoffInfo[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePendingHandoffs(options: UsePendingHandoffsOptions = {}): UsePendingHandoffsReturn {
  const { pollEnabled = true } = options;
  const [handoffs, setHandoffs] = useState<HandoffInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHandoffs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await api.get<{ conversations: ConversationWithLead[] }>(
        '/api/crm/conversations/handoffs'
      );

      const mapped: HandoffInfo[] = result.conversations.map((c) => ({
        conversationId: c._id,
        leadId: c.leadId,
        leadName: c.lead?.name || 'Sin nombre',
        phone: c.lead?.phone,
        handoffReason: c.handoffReason || '',
        handoffStatus: c.handoffStatus || 'pending',
        score: c.lead?.score,
        temperature: c.lead?.temperature,
        lastMessageAt: new Date(c.lastMessageAt),
        state: c.state,
      }));

      setHandoffs(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar handoffs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHandoffs();
  }, [fetchHandoffs]);

  // Poll every 15 seconds — only when this hook owns the cadence.
  useEffect(() => {
    if (!pollEnabled) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchHandoffs();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchHandoffs, pollEnabled]);

  return {
    count: handoffs.length,
    handoffs,
    loading,
    error,
    refetch: fetchHandoffs,
  };
}
