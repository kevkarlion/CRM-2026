'use client'

import { StatusBadge } from '@/components/quotes/status-color'
import type { IQuote } from '@/quotes/types/quote'

interface ExecutiveSummaryHeaderProps {
  quote: IQuote
  leadName?: string
  responsibleName?: string
}

export function ExecutiveSummaryHeader({ quote, leadName, responsibleName }: ExecutiveSummaryHeaderProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
      <div className="space-y-1 min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
          {quote.title || `Cotización #${quote.number}`}
        </h1>
        {quote.title && (
          <p className="text-sm text-gray-400">#{quote.number}</p>
        )}
        {leadName && (
          <p className="text-sm text-gray-500">{leadName}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-gray-400">v{quote.currentVersion}</span>
        <StatusBadge status={quote.status} />
      </div>
    </div>

      {quote.description && (
        <p className="text-sm text-gray-600 mb-4 pb-4 border-b border-gray-100">
          {quote.description}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <div className="bg-brand-50 rounded-lg px-3 py-2 col-span-2 md:col-span-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-600">Importe Total</span>
          <p className="font-bold text-base text-brand-700">
            ${quote.total?.toLocaleString('es-CL')}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Fecha Creación</span>
          <p className="text-sm font-medium text-gray-900">
            {new Date(quote.createdAt).toLocaleDateString('es-CL')}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Vencimiento</span>
          <p className="text-sm font-medium text-gray-900">
            {quote.validUntil
              ? new Date(quote.validUntil).toLocaleDateString('es-CL')
              : 'Sin definir'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Responsable</span>
          <p className="text-sm font-medium text-gray-900">{responsibleName || 'No asignado'}</p>
        </div>
      </div>
    </div>
  )
}
