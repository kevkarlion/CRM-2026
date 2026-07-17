'use client'

import Link from 'next/link'

interface EntityRelationshipsProps {
  quoteId: string
  leadId?: string
  negotiationId?: string
  hasWorkOrder: boolean
}

export function EntityRelationships({
  quoteId,
  leadId,
  negotiationId,
  hasWorkOrder,
}: EntityRelationshipsProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Relaciones</h2>

      <div className="flex flex-col items-center space-y-2 text-sm">
        {leadId && (
          <>
            <Link
              href={`/leads/${leadId}`}
              className="text-brand-600 hover:underline"
            >
              Lead
            </Link>
            <span className="text-gray-400">↓</span>
          </>
        )}

        <span className="font-medium text-gray-900 bg-gray-100 px-3 py-1 rounded">
          Cotización
        </span>

        {negotiationId && (
          <>
            <span className="text-gray-400">↓</span>
            <Link
              href={`/negotiations/${negotiationId}`}
              className="text-brand-600 hover:underline"
            >
              Negociación
            </Link>
          </>
        )}

        {hasWorkOrder && (
          <>
            <span className="text-gray-400">↓</span>
            <span className="text-gray-500">Orden de Trabajo</span>
          </>
        )}
      </div>
    </div>
  )
}
