import { useState, useEffect, useCallback } from 'react';
import type { IClient } from '@/crm/types/client';

interface UseBotClientsReturn {
  clients: IClient[];
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

export function useBotClients(): UseBotClientsReturn {
  const [clients, setClients] = useState<IClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch('/api/crm/clients/with-active-conversation', {
        headers: { ...authHeaders() },
      });
      
      if (!res.ok) {
        throw new Error('Error al cargar clientes del bot');
      }
      
      const json = await res.json();
      setClients(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return {
    clients,
    loading,
    error,
    refetch: fetchClients,
  };
}
