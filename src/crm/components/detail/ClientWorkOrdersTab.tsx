'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { EntityEmptyState } from '@/components/entity-detail';
import { api, unwrapData } from '@/lib/api-client';
import { formatDateShort } from '@/operations/helpers/date-utils';
import { WORK_ORDER_STATUS_LABELS } from '@/operations/constants/status-labels';
import { WORK_ORDER_STATUS_VARIANT } from '@/operations/constants/status-colors';

interface WorkOrderListItem {
  _id: string;
  workOrderNumber: string;
  title: string;
  status: string;
  priority?: string;
  scheduledDate?: string | null;
  createdAt?: string;
}

interface ClientWorkOrdersTabProps {
  clientId: string;
}

export function ClientWorkOrdersTab({ clientId }: ClientWorkOrdersTabProps) {
  const [workOrders, setWorkOrders] = useState<WorkOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkOrders() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<{ data: WorkOrderListItem[] }>('/api/operations/work-orders', {
          clientId,
          limit: '50',
        });
        if (!cancelled) {
          setWorkOrders(unwrapData<WorkOrderListItem[]>(res));
        }
      } catch (err) {
        console.error('Error loading client work orders:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar órdenes de trabajo');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadWorkOrders();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-40 rounded bg-gray-200 animate-pulse" />
        {[1, 2].map((i) => (
          <div key={i} className="h-24 w-full rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
        {error}
      </div>
    );
  }

  if (workOrders.length === 0) {
    return (
      <EntityEmptyState
        icon={
          <svg
            className="h-12 w-12"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        }
        title="No hay órdenes de trabajo"
        description="Este cliente aún no tiene órdenes de trabajo asociadas."
      />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">
        Órdenes de trabajo{' '}
        <span className="font-normal text-gray-500">({workOrders.length})</span>
      </h2>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {workOrders.map((workOrder) => (
          <Link
            key={workOrder._id}
            href={`/work-orders/${workOrder._id}`}
            className="block rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 hover:text-brand-600 transition-colors">
                  {workOrder.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">#{workOrder.workOrderNumber}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatDateShort(workOrder.scheduledDate || workOrder.createdAt)}
                </p>
              </div>
              <div className="shrink-0">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${WORK_ORDER_STATUS_VARIANT[workOrder.status] || 'bg-gray-100 text-gray-700'}`}
                >
                  {WORK_ORDER_STATUS_LABELS[workOrder.status as keyof typeof WORK_ORDER_STATUS_LABELS] || workOrder.status}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
