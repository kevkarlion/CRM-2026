'use client';

import { EntityEmptyState } from '@/components/entity-detail';

/**
 * Prepared tab: work orders for a client are not fetchable through the
 * existing APIs (the work-orders list endpoint has no clientId filter).
 * Renders a graceful empty state until a data connection exists.
 */
export function ClientWorkOrdersTab() {
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
