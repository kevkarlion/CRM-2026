'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

export interface MyWorkOrder {
  _id: string;
  workOrderNumber: string;
  title: string;
  status: string;
  priority: string;
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  clientSnapshot?: { name?: string };
  locationSnapshot?: { address?: string };
  assignedTechnicians?: Array<{ _id: string; name: string; email?: string }>;
}

interface MyWorkOrdersResponse {
  data: MyWorkOrder[];
  total: number;
}

export function useMyWorkOrders() {
  const [orders, setOrders] = useState<MyWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await api.get<MyWorkOrdersResponse>('/api/operations/work-orders/my-orders');
      setOrders(result.data || []);
      setTotal(result.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar mis órdenes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    loading,
    error,
    total,
    refetch: fetchOrders,
  };
}