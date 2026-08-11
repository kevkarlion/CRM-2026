'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import type { IQuote } from '@/quotes/types/quote'

interface SourceDocument {
  _id: string
  title: string
  filename: string
  secureUrl: string
  mimeType: string
}

interface GeneralInfoCardProps {
  quote: IQuote
  sourceDocument?: SourceDocument | null
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-700 font-medium text-right">{value}</dd>
    </div>
  )
}

export function GeneralInfoCard({ quote, sourceDocument }: GeneralInfoCardProps) {
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

      {/* Source Document - Simplified */}
      {quote.sourceDocumentId && sourceDocument && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mt-4">
          <p className="text-xs font-medium text-purple-600 mb-1">Documento de origen</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-medium text-gray-900">
                {sourceDocument.title || sourceDocument.filename}
              </span>
            </div>
            {sourceDocument.secureUrl && (
              <a
                href={sourceDocument.secureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
              >
                Ver
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}