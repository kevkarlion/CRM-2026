import { useState, useEffect, useCallback } from 'react';

export type CustomerSource = 'gestion' | 'client' | 'lead-won';

export interface CustomerEntry {
  // Identificadores
  type: CustomerSource;
  id: string;
  clientId?: string | null;
  gestionId?: string | null;
  leadId?: string | null;
  
  // Datos del cliente
  name: string;
  phone: string | null;
  email?: string | null;
  profileName?: string | null;
  address?: string | null;
  locality?: string | null;
  province?: string | null;
  status?: string;
  operationStatus?: string;
  
  // Datos adicionales
  temperature?: 'hot' | 'warm' | 'cold' | null;
  score?: number | null;
  priority?: string | null;
  estimatedValue?: number | null;
  inquiryReason?: string | null;
  
  // Metadatos
  source: CustomerSource;
  lastActivityAt: string;
  createdAt?: string;
  
  // Estado de conversación
  hasActiveConversation: boolean;
  conversationId?: string;
  lifecycleState?: 'ACTIVE_CLIENT' | 'WAITING_CLIENT' | 'IN_PROGRESS' | null;
  owner?: 'BOT' | 'OPERATOR' | null;
  lastMessageAt?: string | null;
  lastReadAt?: string | null;
  lastInboundMessageAt?: string | null;
  lastMessagePreview?: string | null;
  hasNewActivity?: boolean;
}

interface UseCustomerConversationsReturn {
  customers: CustomerEntry[];
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
  const [customers, setCustomers] = useState<CustomerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch('/api/crm/conversations/customers', {
        headers: { ...authHeaders() },
      });
      
      if (!res.ok) {
        throw new Error('Error al cargar clientes');
      }
      
      const json = await res.json();
      setCustomers(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return {
    customers,
    loading,
    error,
    refetch: fetchCustomers,
  };
}
