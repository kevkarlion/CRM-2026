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

function formatWorkOrderNumber(number: string): string {
  // Format: "2026-WO-000001" or "20260001" → "#06-0001"
  if (!number) return '';
  const clean = number.replace(/[^0-9]/g, '');
  if (clean.length >= 6) {
    const year = clean.slice(-6, -4);
    const seq = clean.slice(-4);
    return `#${year}-${seq}`;
  }
  return `#${number}`;
}

interface LeadWorkOrdersTabProps {
  leadId: string;
}

export function LeadWorkOrdersTab({ leadId }: LeadWorkOrdersTabProps) {
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
          leadId,
          limit: '50',
        });
        if (!cancelled) {
          setWorkOrders(unwrapData<WorkOrderListItem[]>(res));
        }
      } catch (err) {
        console.error('Error loading lead work orders:', err);
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
  }, [leadId]);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nº</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acción</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {[1, 2, 3].map((i) => (
              <tr key={i}>
                <td className="px-4 py-3"><div className="h-4 w-12 bg-gray-200 rounded animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 rounded animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-5 w-16 bg-gray-200 rounded animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-5 w-10 bg-gray-200 rounded animate-pulse ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
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
        description="Este lead aún no tiene órdenes de trabajo asociadas. Se generan al confirmar una venta."
      />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">
        Órdenes de trabajo{' '}
        <span className="font-normal text-gray-500">({workOrders.length})</span>
      </h2>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nº
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Título
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {workOrders.map((workOrder) => (
              <tr key={workOrder._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {formatWorkOrderNumber(workOrder.workOrderNumber)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {workOrder.title}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {formatDateShort(workOrder.scheduledDate || workOrder.createdAt)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${WORK_ORDER_STATUS_VARIANT[workOrder.status] || 'bg-gray-100 text-gray-700'}`}
                  >
                    {WORK_ORDER_STATUS_LABELS[workOrder.status as keyof typeof WORK_ORDER_STATUS_LABELS] || workOrder.status}
                  </span>
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-right align-middle">
                  <Link
                    href={`/work-orders/${workOrder._id}`}
                    className="inline-flex items-center rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-100 cursor-pointer"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
