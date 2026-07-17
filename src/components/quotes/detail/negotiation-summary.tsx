'use client'

import Link from 'next/link'

interface NegotiationSummaryProps {
  negotiation?: {
    _id: string
    status: string
    counterOffersCount: number
    lastUpdate?: Date | string
    nextFollowUp?: Date | string
  } | null
}

export function NegotiationSummary({ negotiation }: NegotiationSummaryProps) {
  if (!negotiation) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Negociación</h2>

      <dl className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <dt className="text-gray-500">Estado</dt>
          <dd className="text-gray-700 font-medium">{negotiation.status}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Contraofertas</dt>
          <dd className="text-gray-700">{negotiation.counterOffersCount}</dd>
        </div>
        {negotiation.lastUpdate && (
          <div className="flex justify-between">
            <dt className="text-gray-500">Última Actualización</dt>
            <dd className="text-gray-700">
              {new Date(negotiation.lastUpdate).toLocaleDateString('es-CL')}
            </dd>
          </div>
        )}
        {negotiation.nextFollowUp && (
          <div className="flex justify-between">
            <dt className="text-gray-500">Próximo Seguimiento</dt>
            <dd className="text-gray-700">
              {new Date(negotiation.nextFollowUp).toLocaleDateString('es-CL')}
            </dd>
          </div>
        )}
      </dl>

      <Link
        href={`/negotiations/${negotiation._id}`}
        className="block w-full text-center px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
      >
        Ver Negociación
      </Link>
    </div>
  )
}
