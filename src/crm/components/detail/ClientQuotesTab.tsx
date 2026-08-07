'use client';

import { EntityEmptyState } from '@/components/entity-detail';
import type { QuoteListItem } from './client-detail.types';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_VARIANT, formatCurrency } from './client-detail.constants';

interface ClientQuotesTabProps {
  quotes: QuoteListItem[];
  loading: boolean;
}

export function ClientQuotesTab({ quotes, loading }: ClientQuotesTabProps) {
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

  if (quotes.length === 0) {
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
        title="No hay presupuestos"
        description="Este cliente aún no tiene presupuestos asociados."
      />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">
        Presupuestos{' '}
        <span className="font-normal text-gray-500">({quotes.length})</span>
      </h2>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {quotes.map((quote) => (
          <a
            key={quote._id}
            href={`/quotes/${quote._id}`}
            className="block rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 hover:text-brand-600 transition-colors">
                  {quote.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">#{quote.number}</p>
              </div>
              <div className="shrink-0 text-right">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${QUOTE_STATUS_VARIANT[quote.status] || 'bg-gray-100 text-gray-700'}`}
                >
                  {QUOTE_STATUS_LABELS[quote.status] || quote.status}
                </span>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {formatCurrency(quote.total)}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
