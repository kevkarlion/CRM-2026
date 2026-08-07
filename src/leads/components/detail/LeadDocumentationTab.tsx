'use client';

import { EntityEmptyState } from '@/components/entity-detail';

/**
 * Placeholder tab: documentation is planned for a future version.
 * No document logic, entities, storage or uploads.
 */
export function LeadDocumentationTab() {
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      }
      title="Documentación"
      description="La sección de documentación estará disponible en una próxima versión del CRM."
    />
  );
}
