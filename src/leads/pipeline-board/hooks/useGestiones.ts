import { useState, useEffect, useCallback } from 'react';
import type { IGestion, GestionStatus } from '@/gestion/types/gestion';

interface UseGestionesReturn {
  gestions: IGestion[];
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
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': payload.tenantId || 'default',
      'x-user-id': payload.userId || '',
    };
    if (Array.isArray(payload.roles) && payload.roles.length > 0) {
      headers['x-user-roles'] = payload.roles.join(',');
    }
    return headers;
  } catch {
    return { Authorization: `Bearer ${token}` };
  }
}

interface GestionFilters {
  status?: GestionStatus;
  clientId?: string;
  assignedTo?: string;
  source?: string;
  search?: string;
  isVisible?: boolean;
  excludeTerminalStatuses?: boolean;
  sortByVisibleAt?: boolean;
}

export function useGestiones(filters?: GestionFilters): UseGestionesReturn {
  const [gestions, setGestions] = useState<IGestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGestiones = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.clientId) params.set('clientId', filters.clientId);
      if (filters?.assignedTo) params.set('assignedTo', filters.assignedTo);
      if (filters?.source) params.set('source', filters.source);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.isVisible !== undefined) params.set('isVisible', String(filters.isVisible));
      if (filters?.excludeTerminalStatuses) params.set('excludeTerminal', 'true');
      if (filters?.sortByVisibleAt) params.set('sortByVisibleAt', 'true');
      params.set('limit', '100');

      const res = await fetch(`/api/crm/gestiones?${params.toString()}`, {
        headers: { ...authHeaders() },
      });

      if (!res.ok) {
        throw new Error('Error al cargar gestions');
      }

      const json = await res.json();
      setGestions(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchGestiones();
  }, [fetchGestiones]);

  return {
    gestions,
    loading,
    error,
    refetch: fetchGestiones,
  };
}