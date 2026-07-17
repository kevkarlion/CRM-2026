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
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-gray-900">
            {quote.title || `Cotización #${quote.number}`}
          </h1>
          {quote.title && (
            <p className="text-sm text-gray-400">#{quote.number}</p>
          )}
          {leadName && (
            <p className="text-sm text-gray-500">{leadName}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">v{quote.currentVersion}</span>
          <StatusBadge status={quote.status} />
        </div>
      </div>

      {quote.description && (
        <p className="text-sm text-gray-600 mb-4 pb-4 border-b border-gray-100">
          {quote.description}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Importe Total</span>
          <p className="font-semibold text-lg text-gray-900">
            ${quote.total?.toLocaleString('es-CL')}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Fecha Creación</span>
          <p className="text-gray-700">
            {new Date(quote.createdAt).toLocaleDateString('es-CL')}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Vencimiento</span>
          <p className="text-gray-700">
            {quote.validUntil
              ? new Date(quote.validUntil).toLocaleDateString('es-CL')
              : 'Sin definir'}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Responsable</span>
          <p className="text-gray-700">{responsibleName || 'No asignado'}</p>
        </div>
      </div>
    </div>
  )
}
