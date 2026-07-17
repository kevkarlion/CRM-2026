export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'low' | 'none'

export interface DecisionContext {
  quote: {
    _id: string
    status: string
    validUntil?: Date | string | null
    leadId?: string | null
    clientId?: string | null
    convertedToWorkOrder?: string | null
    items: Array<{
      name?: string
      description: string
      quantity: number
      unitPrice: number
      subtotal: number
      notes?: string
    }>
    subtotal: number
    discountAmount: number
    taxAmount: number
    total: number
  }
  lead?: {
    _id: string
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
  hasWorkOrder: boolean
  workOrderStatus?: string | null
}

export interface Action {
  id: string
  label: string
  variant: 'primary' | 'secondary' | 'danger' | 'ghost'
  icon?: string
  disabled?: boolean
  tooltip?: string
}

export interface PriorityInfo {
  level: PriorityLevel
  label: string
  description: string
}

export interface DecisionOutput {
  actions: Action[]
  priority: PriorityInfo
  warnings: string[]
  canConfirmSale: boolean
}
