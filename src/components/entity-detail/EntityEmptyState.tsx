'use client';

import type { ReactNode } from 'react';

export interface EntityEmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Generic empty state used inside tab panels.
 * Follows the CRM design-system empty state pattern.
 */
export function EntityEmptyState({ icon, title, description, action, className }: EntityEmptyStateProps) {
  return (
    <div className={['text-center py-14', className].filter(Boolean).join(' ')}>
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center text-gray-300">
          {icon}
        </div>
      )}
      <p className="text-lg font-medium text-gray-900">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
