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

      {/* Source Document - cuando viene del panel de documentación del lead */}
      {quote.sourceDocumentId && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Documento Adjunto</h3>
          {sourceDocument ? (
            <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                {/* Icono de PDF */}
                <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {sourceDocument.title || sourceDocument.filename || 'Documento PDF'}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    Documento enviado desde el lead
                  </p>
                  
                  {sourceDocument.secureUrl && (
                    <div className="mt-3 flex gap-2">
                      <a
                        href={sourceDocument.secureUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Ver PDF
                      </a>
                      <a
                        href={sourceDocument.secureUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-white text-purple-700 border border-purple-200 hover:bg-purple-50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Descargar
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Documento PDF</p>
                  <p className="text-xs text-gray-500">ID: {String(quote.sourceDocumentId)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}