'use client';

import Link from 'next/link';

import { EntityEmptyState } from '@/components/entity-detail';
import { getDaysUntilExpiry } from '@/lib/format-date';
import type { QuoteListItem } from './lead-detail.types';
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_VARIANT,
  formatCurrency,
} from './lead-detail.constants';

// Móvil: badges sólidos y acento izquierdo (la tabla desktop conserva las variantes pastel)
const QUOTE_STATUS_VARIANT_MOBILE: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-800',
  sent: 'bg-sky-600 text-white',
  approved: 'bg-emerald-700 text-white',
  rejected: 'bg-rose-600 text-white',
  expired: 'bg-amber-500 text-gray-900',
  cancelled: 'bg-gray-500 text-white',
  direct_sale: 'bg-emerald-700 text-white',
};

const QUOTE_STATUS_ACCENT: Record<string, string> = {
  draft: 'border-l-gray-300',
  sent: 'border-l-sky-500',
  approved: 'border-l-emerald-500',
  rejected: 'border-l-rose-500',
  expired: 'border-l-amber-500',
  cancelled: 'border-l-gray-300',
  direct_sale: 'border-l-emerald-500',
};

interface LeadQuotesTabProps {
  quotes: QuoteListItem[];
  loading: boolean;
  sendingQuoteId: string | null;
  canCreate: boolean;
  onViewQuote: (quoteId: string) => void;
  onSendQuote: (quoteId: string) => void;
  onNewQuote: () => void;
}

function QuoteExpiryAlert({ validUntil }: { validUntil: string | null | undefined }) {
  const daysLeft = getDaysUntilExpiry(validUntil ?? null);

  if (daysLeft === null) return null;

  if (daysLeft < 0) {
    return (
      <span className="ml-2 text-xs text-danger-600 font-medium">
        Vencido
      </span>
    );
  }

  if (daysLeft === 0) {
    return (
      <span className="ml-2 text-xs text-danger-600 font-medium">
        Vence hoy
      </span>
    );
  }

  if (daysLeft <= 3) {
    return (
      <span className="ml-2 text-xs text-danger-600 font-medium">
        Vence en {daysLeft}d
      </span>
    );
  }

  if (daysLeft <= 7) {
    return (
      <span className="ml-2 text-xs text-warning-600 font-medium">
        Vence en {daysLeft}d
      </span>
    );
  }

  return null;
}

export function LeadQuotesTab({
  quotes,
  loading,
  sendingQuoteId,
  canCreate,
  onViewQuote,
  onSendQuote,
  onNewQuote,
}: LeadQuotesTabProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-40 rounded bg-gray-200 animate-pulse" />
        <div className="h-64 w-full rounded-xl bg-gray-100 animate-pulse" />
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
        description="Este lead aún no tiene presupuestos asociados."
        action={
          canCreate ? (
            <button
              onClick={onNewQuote}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
            >
              Crear Presupuesto
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <button
            onClick={onNewQuote}
            className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
          >
            Nuevo Presupuesto
          </button>
        </div>
      )}

      <div className="hidden sm:block overflow-hidden rounded-lg border border-gray-200">
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
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {quotes.map((quote) => (
              <tr key={quote._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  #{quote.number}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {quote.title}
                  {quote.status === 'sent' && <QuoteExpiryAlert validUntil={quote.validUntil} />}
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
                <td className="px-2 py-1.5 whitespace-nowrap text-right align-middle">
                  <button
                    onClick={() => onViewQuote(quote._id)}
                    className="inline-flex items-center rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-100 cursor-pointer"
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden space-y-3">
        {quotes.map((quote) => (
          <div
            key={quote._id}
            className={`bg-white border border-gray-200 border-l-4 rounded-xl p-4 shadow-sm space-y-3 ${QUOTE_STATUS_ACCENT[quote.status] || 'border-l-gray-300'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-gray-500">#{quote.number}</p>
                <p className="font-medium text-gray-900 truncate">{quote.title}</p>
              </div>
              <span
                className={`inline-flex items-center shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${QUOTE_STATUS_VARIANT_MOBILE[quote.status] || 'bg-gray-200 text-gray-800'}`}
              >
                {QUOTE_STATUS_LABELS[quote.status] || quote.status}
              </span>
            </div>
            {quote.status === 'sent' && <QuoteExpiryAlert validUntil={quote.validUntil} />}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-lg px-3 py-2 col-span-2">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total</span>
                <span className="block text-sm font-medium text-gray-900">{formatCurrency(quote.total)}</span>
              </div>
            </div>
            <div className="flex border-t border-gray-100 pt-3">
              <button
                onClick={() => onViewQuote(quote._id)}
                className="flex-1 inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors cursor-pointer"
              >
                Ver
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
