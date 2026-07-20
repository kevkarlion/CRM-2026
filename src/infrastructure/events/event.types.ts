// DomainEvent interface
export interface DomainEvent<T = unknown> {
  type: string;           // e.g. 'QUOTE_SENT'
  aggregateId: string;    // ID of the entity that published the event
  aggregateType: string;  // e.g. 'Quote'
  tenantId: string;
  userId: string;
  timestamp: Date;
  payload: T;
}

// Event type constants - one for each business event
export const DOMAIN_EVENTS = {
  // Lead
  LEAD_CREATED: 'LEAD_CREATED',
  LEAD_STATUS_CHANGED: 'LEAD_STATUS_CHANGED',
  LEAD_CONVERTED: 'LEAD_CONVERTED',
  
  // Quote
  QUOTE_CREATED: 'QUOTE_CREATED',
  QUOTE_SENT: 'QUOTE_SENT',
  QUOTE_APPROVED: 'QUOTE_APPROVED',
  QUOTE_REJECTED: 'QUOTE_REJECTED',
  QUOTE_CONVERTED: 'QUOTE_CONVERTED',
  
  // Negotiation
  NEGOTIATION_OPENED: 'NEGOTIATION_OPENED',
  NEGOTIATION_ACCEPTED: 'NEGOTIATION_ACCEPTED',
  NEGOTIATION_REJECTED: 'NEGOTIATION_REJECTED',
  COUNTER_OFFER_CREATED: 'COUNTER_OFFER_CREATED',
  
  // Operations
  WORK_ORDER_CREATED: 'WORK_ORDER_CREATED',
  WORK_ORDER_STATUS_CHANGED: 'WORK_ORDER_STATUS_CHANGED',
  WORK_ORDER_COMPLETED: 'WORK_ORDER_COMPLETED',
  VISIT_CREATED: 'VISIT_CREATED',
  VISIT_STATUS_CHANGED: 'VISIT_STATUS_CHANGED',
  VISIT_COMPLETED: 'VISIT_COMPLETED',
  
  // Sale
  SALE_CONFIRMED: 'SALE_CONFIRMED',
} as const;

export type DomainEventType = typeof DOMAIN_EVENTS[keyof typeof DOMAIN_EVENTS];

// Event payload types for each event
export interface LeadCreatedPayload {
  leadId: string;
  name: string;
  source: string;
  email?: string;
  phone?: string;
  companyName?: string;
}

export interface LeadStatusChangedPayload {
  leadId: string;
  from: string;
  to: string;
  leadName?: string;
}

export interface LeadConvertedPayload {
  leadId: string;
  clientId: string;
  leadName?: string;
  clientName?: string;
}

export interface QuoteCreatedPayload {
  quoteId: string;
  number: string;
  leadId: string | null;
  total: number;
  status: string;
  validUntil: string | null;
  title: string;
  description: string | null;
  notes: string | null;
}

export interface QuoteSentPayload {
  quoteId: string;
  leadId: string;
  number: string;
  total: number;
  title?: string;
  status?: string;
  validUntil?: string | null;
}

export interface QuoteApprovedPayload {
  quoteId: string;
  leadId: string | null;
  number?: string;
  total?: number;
  title?: string;
}

export interface QuoteRejectedPayload {
  quoteId: string;
  leadId: string | null;
  number?: string;
  total?: number;
  title?: string;
  reason?: string;
}

export interface QuoteConvertedPayload {
  quoteId: string;
  workOrderId: string;
  workOrderNumber: string;
  total?: number;
}

export interface NegotiationOpenedPayload {
  negotiationId: string;
  leadId: string;
  leadName?: string;
  initialAmount?: number;
}

export interface NegotiationAcceptedPayload {
  negotiationId: string;
  leadId: string;
  finalAmount?: number;
}

export interface NegotiationRejectedPayload {
  negotiationId: string;
  leadId: string;
  reason?: string;
}

export interface CounterOfferCreatedPayload {
  counterOfferId: string;
  negotiationId: string;
  leadId: string;
  amount?: number;
  reason?: string;
}

export interface WorkOrderCreatedPayload {
  workOrderId: string;
  leadId: string | null;
  number: string;
  clientId: string;
  title?: string;
  category?: string;
  priority?: string;
  scheduledDate?: string;
  clientName?: string;
  address?: string;
}

export interface WorkOrderStatusChangedPayload {
  workOrderId: string;
  from: string;
  to: string;
  number?: string;
  title?: string;
  category?: string;
}

export interface WorkOrderCompletedPayload {
  workOrderId: string;
  number?: string;
}

export interface VisitCreatedPayload {
  visitId: string;
  leadId: string | null;
  number: string;
  title?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  category?: string;
  priority?: string;
  address?: string;
}

export interface VisitStatusChangedPayload {
  visitId: string;
  from: string;
  to: string;
  number?: string;
  title?: string;
}

export interface VisitCompletedPayload {
  visitId: string;
  number?: string;
}

export interface SaleConfirmedPayload {
  leadId: string;
  clientId: string;
  amount: number;
  saleMode: 'quotes' | 'direct';
  leadName?: string;
  quotesCount?: number;
}
