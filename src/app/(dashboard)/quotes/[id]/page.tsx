'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import { Breadcrumb } from '@/lib/components/Breadcrumb'
import { ExecutiveSummaryHeader } from '@/components/quotes/detail/executive-summary-header'
import { GeneralInfoCard } from '@/components/quotes/detail/general-info-card'
import { ServicesCards } from '@/components/quotes/detail/services-cards'
import { DecisionSidePanel } from '@/components/quotes/detail/decision-side-panel'
import { SmartActionBar } from '@/components/quotes/detail/smart-action-bar'
import { ActivityTimeline } from '@/components/quotes/activity-timeline'
import { ConfirmSaleDrawer } from '@/leads/components/ConfirmSaleDrawer'
import { evaluateQuoteDecision } from '@/quotes/helpers/decision-engine'
import type { DecisionOutput } from '@/quotes/types/decision-engine'

interface QuoteDetailData {
  quote: any
  currentVersion: any
  lead: any
  client: any
  negotiation: any
  hasWorkOrder: boolean
  workOrderId: string | null
  workOrderStatus: string | null
}

export default function QuoteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const quoteId = params.id as string

  const [data, setData] = useState<QuoteDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmSale, setShowConfirmSale] = useState(false)

  useEffect(() => {
    fetchQuoteData()
  }, [quoteId])

  async function fetchQuoteData() {
    try {
      setLoading(true)
      const result = await api.get<QuoteDetailData>(`/api/crm/quotes/${quoteId}`)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const decision: DecisionOutput | null = useMemo(() => {
    if (!data) return null
    return evaluateQuoteDecision({
      quote: data.quote,
      lead: data.lead,
      negotiation: data.negotiation,
      hasWorkOrder: data.hasWorkOrder,
      workOrderStatus: data.workOrderStatus,
    })
  }, [data])

  async function handleAction(actionId: string) {
    switch (actionId) {
      case 'confirm-sale':
        setShowConfirmSale(true)
        break
      case 'send':
        try {
          await api.post(`/api/crm/quotes/${quoteId}/send`, {})
          await fetchQuoteData()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Error al enviar')
        }
        break
      case 'edit':
        router.push(`/quotes/${quoteId}/edit`)
        break
      case 'start-negotiation':
        router.push(`/negotiations/new?quoteId=${quoteId}&leadId=${data?.lead?._id}`)
        break
      case 'view-negotiation':
        if (data?.negotiation?._id) {
          router.push(`/negotiations/${data.negotiation._id}`)
        }
        break
      case 'download-pdf':
        // TODO: implement PDF download
        break
      case 'duplicate':
        router.push(`/quotes/new?duplicate=${quoteId}`)
        break
      case 'delete':
        // TODO: implement delete with confirmation modal
        break
      case 'approve-quote':
        try {
          await api.post(`/api/crm/quotes/${quoteId}/approve`, {})
          await fetchQuoteData()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Error al aprobar')
        }
        break
      case 'create-work-order':
        if (data?.workOrderId) {
          router.push(`/work-orders/${data.workOrderId}/edit`)
        }
        break
      case 'edit-work-order':
        if (data?.workOrderId) {
          router.push(`/work-orders/${data.workOrderId}/edit`)
        }
        break
      case 'view-work-order':
        if (data?.workOrderId) {
          router.push(`/work-orders/${data.workOrderId}`)
        }
        break
    }
  }

  function handleConfirmSaleSuccess() {
    setShowConfirmSale(false)
    fetchQuoteData()
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-32 bg-gray-200 rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-6">
            <div className="h-64 bg-gray-200 rounded" />
            <div className="h-48 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
        <p className="text-gray-500 mb-4">{error || 'Cotización no encontrada'}</p>
        <button
          onClick={() => router.back()}
          className="text-brand-600 hover:underline"
        >
          ← Volver
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 pb-24">
      <Breadcrumb
        items={[
          { label: 'Comercial', href: '/quotes' },
          { label: 'Cotizaciones', href: '/quotes' },
          { label: `Cotización #${data.quote.number || quoteId}` },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-6 mt-6">
        <div className="space-y-6">
          <ExecutiveSummaryHeader
            quote={data.quote}
            leadName={data.lead?.name}
          />

          {decision?.warnings && decision.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              {decision.warnings.map((warning, i) => (
                <p key={i} className="text-sm text-yellow-700">{warning}</p>
              ))}
            </div>
          )}

          <GeneralInfoCard quote={data.quote} />

          <ServicesCards items={data.quote.items || []} />

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen Económico</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Subtotal</dt>
                <dd className="text-gray-700">${data.quote.subtotal?.toLocaleString('es-CL')}</dd>
              </div>
              {data.quote.discountAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Descuentos</dt>
                  <dd className="text-red-600">-${data.quote.discountAmount?.toLocaleString('es-CL')}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Impuestos</dt>
                <dd className="text-gray-700">${data.quote.taxAmount?.toLocaleString('es-CL')}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                <dt className="font-semibold text-gray-900">Total</dt>
                <dd className="font-bold text-lg text-gray-900">${data.quote.total?.toLocaleString('es-CL')}</dd>
              </div>
            </dl>
          </div>

          <ActivityTimeline
            entityId={quoteId}
            entityType="quote"
          />
        </div>

        <div className="space-y-4">
          <DecisionSidePanel
            priority={decision?.priority || { level: 'none', label: '', description: '' }}
            client={data.client}
            lead={data.lead}
            negotiation={data.negotiation}
            quoteId={quoteId}
            leadId={data.lead?._id}
            hasWorkOrder={data.hasWorkOrder}
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
        <div className="max-w-7xl mx-auto">
          <SmartActionBar
            actions={decision?.actions || []}
            onAction={handleAction}
            loading={loading}
          />
        </div>
      </div>

      {showConfirmSale && data.lead && (
        <ConfirmSaleDrawer
          isOpen={showConfirmSale}
          onClose={() => setShowConfirmSale(false)}
          leadId={data.lead._id}
          leadName={data.lead.name}
          onSuccess={handleConfirmSaleSuccess}
        />
      )}
    </div>
  )
}
