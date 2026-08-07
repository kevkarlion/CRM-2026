'use client';

import { EntityEmptyState } from '@/components/entity-detail';
import { getDaysUntilExpiry } from '@/lib/format-date';
import type { QuoteListItem } from './lead-detail.types';
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_VARIANT,
  formatCurrency,
} from './lead-detail.constants';

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
      <div className="mt-2 p-2 bg-danger-50 border border-danger-200 rounded-lg">
        <p className="text-xs text-danger-700 font-medium">
          ⚠️ Vencido hace {Math.abs(daysLeft)} días
        </p>
      </div>
    );
  }

  if (daysLeft === 0) {
    return (
      <div className="mt-2 p-2 bg-danger-50 border border-danger-200 rounded-lg">
        <p className="text-xs text-danger-700 font-medium">⚠️ Vence hoy</p>
      </div>
    );
  }

  if (daysLeft <= 3) {
    return (
      <div className="mt-2 p-2 bg-danger-50 border border-danger-200 rounded-lg">
        <p className="text-xs text-danger-700 font-medium">
          ⏰ Vence en {daysLeft} día{daysLeft !== 1 ? 's' : ''}
        </p>
      </div>
    );
  }

  if (daysLeft <= 7) {
    return (
      <div className="mt-2 p-2 bg-warning-50 border border-warning-200 rounded-lg">
        <p className="text-xs text-warning-700 font-medium">⏰ Vence en {daysLeft} días</p>
      </div>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-gray-900">
          Presupuestos{' '}
          <span className="font-normal text-gray-500">({quotes.length})</span>
        </h2>
        {canCreate && (
          <button
            onClick={onNewQuote}
            className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
          >
            Nuevo Presupuesto
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {quotes.map((quote) => (
          <div key={quote._id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => onViewQuote(quote._id)}
                  className="text-left text-sm font-medium text-gray-900 hover:text-brand-600 transition-colors"
                >
                  {quote.title}
                </button>
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

            {quote.status === 'sent' && <QuoteExpiryAlert validUntil={quote.validUntil} />}

            <div className="mt-3 flex gap-2 border-t border-gray-200 pt-3">
              <button
                onClick={() => onViewQuote(quote._id)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Ver Detalle
              </button>
              {quote.status === 'draft' && (
                <button
                  onClick={() => onSendQuote(quote._id)}
                  disabled={sendingQuoteId === quote._id}
                  className="flex-1 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {sendingQuoteId === quote._id ? 'Enviando...' : 'Enviar'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
