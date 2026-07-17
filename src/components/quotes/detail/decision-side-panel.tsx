'use client'

import { PriorityIndicator } from './priority-indicator'
import { CommercialInfoBlock } from './commercial-info-block'
import { NegotiationSummary } from './negotiation-summary'
import { EntityRelationships } from './entity-relationships'
import type { PriorityInfo } from '@/quotes/types/decision-engine'

interface DecisionSidePanelProps {
  priority: PriorityInfo
  client?: {
    fullName?: string
    companyName?: string
    email?: string
    phone?: string
  } | null
  lead?: {
    name?: string
    email?: string
    phone?: string
    companyName?: string
    status: string
    pipelineStage?: string
    origin?: string
    responsible?: string
    createdAt?: Date | string
  } | null
  negotiation?: {
    _id: string
    status: string
    counterOffersCount: number
    lastUpdate?: Date | string
    nextFollowUp?: Date | string
  } | null
  quoteId: string
  leadId?: string
  hasWorkOrder: boolean
}

export function DecisionSidePanel({
  priority,
  client,
  lead,
  negotiation,
  quoteId,
  leadId,
  hasWorkOrder,
}: DecisionSidePanelProps) {
  return (
    <div className="space-y-4 lg:sticky lg:top-4">
      <PriorityIndicator priority={priority} />
      <CommercialInfoBlock client={client} lead={lead} />
      <NegotiationSummary negotiation={negotiation} />
      <EntityRelationships
        quoteId={quoteId}
        leadId={leadId}
        negotiationId={negotiation?._id}
        hasWorkOrder={hasWorkOrder}
      />
    </div>
  )
}
