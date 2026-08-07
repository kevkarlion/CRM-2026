'use client';

import { EntityEmptyState } from '@/components/entity-detail';

/**
 * Prepared tab: technical visits for a client are not fetchable through the
 * existing APIs (the technical-visits list endpoint has no clientId filter).
 * Renders a graceful empty state until a data connection exists.
 */
export function ClientVisitsTab() {
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
            d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 8a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17h3.839c.278 0 .554-.042.82-.122M19 9.34V7a3 3 0 00-3-3h-5m1 4v1.5m-5.5 8.5h.5"
          />
        </svg>
      }
      title="No hay visitas técnicas"
      description="Este cliente aún no tiene visitas técnicas asociadas."
    />
  );
}
