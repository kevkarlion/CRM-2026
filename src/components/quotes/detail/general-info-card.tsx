'use client'

import type { IQuote } from '@/quotes/types/quote'

interface GeneralInfoCardProps {
  quote: IQuote
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-700 font-medium text-right">{value}</dd>
    </div>
  )
}

export function GeneralInfoCard({ quote }: GeneralInfoCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Información General</h2>

      <dl className="divide-y divide-gray-100">
        <InfoRow label="Título" value={quote.title || 'No especificado'} />
        {quote.description && <InfoRow label="Descripción" value={quote.description} />}
        <InfoRow label="Versión" value={`v${quote.currentVersion}`} />
        {quote.notes && <InfoRow label="Notas" value={quote.notes} />}
        {quote.rejectedReason && (
          <InfoRow label="Motivo de rechazo" value={quote.rejectedReason} />
        )}
      </dl>

      <h3 className="text-sm font-semibold text-gray-900 mt-4 mb-2">Fechas</h3>
      <dl className="divide-y divide-gray-100">
        <InfoRow
          label="Creado"
          value={new Date(quote.createdAt).toLocaleDateString('es-CL', {
            year: 'numeric', month: 'short', day: 'numeric',
          })}
        />
        {quote.sentAt && (
          <InfoRow
            label="Enviado"
            value={new Date(quote.sentAt).toLocaleDateString('es-CL', {
              year: 'numeric', month: 'short', day: 'numeric',
            })}
          />
        )}
        {quote.approvedAt && (
          <InfoRow
            label={quote.status === 'direct_sale' ? 'Venta realizada' : 'Aprobado'}
            value={new Date(quote.approvedAt).toLocaleDateString('es-CL', {
              year: 'numeric', month: 'short', day: 'numeric',
            })}
          />
        )}
        {quote.rejectedAt && (
          <InfoRow
            label="Rechazado"
            value={new Date(quote.rejectedAt).toLocaleDateString('es-CL', {
              year: 'numeric', month: 'short', day: 'numeric',
            })}
          />
        )}
        {quote.validUntil && (
          <InfoRow
            label="Vencimiento"
            value={new Date(quote.validUntil).toLocaleDateString('es-CL', {
              year: 'numeric', month: 'short', day: 'numeric',
            })}
          />
        )}
        {quote.convertedAt && (
          <InfoRow
            label="Convertido"
            value={new Date(quote.convertedAt).toLocaleDateString('es-CL', {
              year: 'numeric', month: 'short', day: 'numeric',
            })}
          />
        )}
      </dl>
    </div>
  )
}
