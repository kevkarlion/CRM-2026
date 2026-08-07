'use client';

import Link from 'next/link';

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
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nº</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {[1, 2, 3].map((i) => (
              <tr key={i}>
                <td className="px-4 py-3"><div className="h-4 w-12 bg-gray-200 rounded animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 rounded animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-5 w-16 bg-gray-200 rounded animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
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
                Estado
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {quotes.map((quote) => (
              <tr key={quote._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  #{quote.number}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/quotes/${quote._id}`}
                    className="text-sm font-medium text-gray-900 hover:text-brand-600"
                  >
                    {quote.title}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${QUOTE_STATUS_VARIANT[quote.status] || 'bg-gray-100 text-gray-700'}`}
                  >
                    {QUOTE_STATUS_LABELS[quote.status] || quote.status}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                  {formatCurrency(quote.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
