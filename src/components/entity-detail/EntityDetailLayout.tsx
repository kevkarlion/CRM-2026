'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export interface EntityDetailLayoutProps {
  backHref: string;
  backLabel?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Page-level layout for entity detail views (Lead, Client, ...).
 *
 * Renders the back link, title, subtitle, badges and action area, then
 * delegates the rest of the page (typically an <EntityTabs>) to children.
 */
export function EntityDetailLayout({
  backHref,
  backLabel = 'Volver',
  title,
  subtitle,
  badges,
  actions,
  children,
  className,
}: EntityDetailLayoutProps) {
  return (
    <div className={['space-y-6', className].filter(Boolean).join(' ')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Link
            href={backHref}
            aria-label={backLabel}
            title={backLabel}
            className="mt-0.5 shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{title}</h1>
              {badges}
            </div>
            {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>

      {children}
    </div>
  );
}
