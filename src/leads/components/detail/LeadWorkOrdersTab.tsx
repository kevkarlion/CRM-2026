'use client';

import { EntityEmptyState } from '@/components/entity-detail';
import { WORK_ORDER_STATUS_VARIANT } from '@/operations/constants/status-colors';
import { formatShortDate } from './lead-detail.constants';
import type { WorkOrderListItem } from './lead-detail.types';

interface LeadWorkOrdersTabProps {
  workOrders: WorkOrderListItem[];
  loading: boolean;
}

export function LeadWorkOrdersTab({ workOrders, loading }: LeadWorkOrdersTabProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-44 rounded bg-gray-200 animate-pulse" />
        <div className="h-24 w-full rounded-xl bg-gray-100 animate-pulse" />
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
        description="Este lead aún no tiene órdenes de trabajo asociadas. Se generan al confirmar una venta o convertir el lead."
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
          <a
            key={workOrder._id}
            href={`/work-orders/${workOrder._id}`}
            className="block rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {workOrder.title || workOrder.workOrderNumber}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">#{workOrder.workOrderNumber}</p>
              </div>
              <div className="shrink-0 text-right">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    WORK_ORDER_STATUS_VARIANT[workOrder.status] || 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {workOrder.status}
                </span>
                {workOrder.scheduledDate && (
                  <p className="mt-1 text-xs text-gray-500">
                    {formatShortDate(workOrder.scheduledDate)}
                  </p>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
