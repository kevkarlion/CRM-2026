import { useState, useEffect, useCallback } from 'react';

interface CustomerConversation {
  conversationId: string;
  phoneNumber: string;
  lifecycleState: 'ACTIVE_CLIENT' | 'WAITING_CLIENT' | 'IN_PROGRESS';
  owner: 'BOT' | 'OPERATOR';
  lastMessageAt: string;
  lastActivityAt: string;
  waitingMessageCount: number;
  waitingPriority: 'normal' | 'medium' | 'high';
  assignedToUserId: string | null;
  clientId: string | null;
  clientName: string;
  clientPhone: string | null;
  clientScore: number | null;
  clientTemperature: 'hot' | 'warm' | 'cold' | null;
}

interface UseCustomerConversationsReturn {
  conversations: CustomerConversation[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token');
  if (!token) return {};
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': payload.tenantId || 'default',
      'x-user-id': payload.userId || '',
    };
  } catch {
    return {};
  }
}

export function useCustomerConversations(): UseCustomerConversationsReturn {
  const [conversations, setConversations] = useState<CustomerConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch('/api/crm/conversations/customers', {
        headers: { ...authHeaders() },
      });
      
      if (!res.ok) {
        throw new Error('Error al cargar conversaciones de clientes');
      }
      
      const json = await res.json();
      setConversations(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    loading,
    error,
    refetch: fetchConversations,
  };
}
