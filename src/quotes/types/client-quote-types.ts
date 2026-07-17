export type NextActionType =
  | 'send_quote'
  | 'follow_up'
  | 'go_to_negotiation'
  | 'convert_to_work_order'
  | 'contact_client'
  | 'review_and_requote'
  | 'respond_counteroffer'
  | 'confirm_sale'
  | 'schedule_work_order'
  | 'awaiting_execution'
  | 'none';

export const NEXT_ACTION_LABELS: Record<NextActionType, string> = {
  send_quote: 'Enviar cotización',
  follow_up: 'Dar seguimiento',
  go_to_negotiation: 'Ir a negociación',
  convert_to_work_order: 'Convertir a orden de trabajo',
  contact_client: 'Contactar cliente',
  review_and_requote: 'Revisar y re-cotizar',
  respond_counteroffer: 'Responder contraoferta',
  confirm_sale: 'Confirmar Venta',
  schedule_work_order: 'Programar la OT',
  awaiting_execution: 'Esperando ejecución',
  none: '—',
};

export type ExpiryBadgeType = 'expired' | 'expiring' | 'none';

export interface ExpiryBadgeResult {
  type: ExpiryBadgeType;
  label: string;
  colorClass: string;
}

export interface QuoteTableRow {
  id: string;
  entityType: 'quote' | 'negotiation';
  clientName: string;
  companyName?: string;
  status: string;
  total: number | null;
  validUntil: string | null;
  nextAction: NextActionType;
  assignedName: string;
  createdAt: string;
  entityStatus: string;
  workOrderStatus?: string | null;
  leadStatus?: string | null;
}

export interface QuoteSummaryStats {
  activeQuotes: number;
  pendingNegotiations: number;
  conversionRate: number;
  totalPotentialValue: number;
}

export interface WorkTrayItem {
  id: string;
  entityType: 'quote' | 'negotiation';
  clientName: string;
  category: 'expiring' | 'awaiting' | 'recently_approved';
  validUntil?: string;
  status: string;
  total?: number;
}

export interface FilterState {
  status: string[];
  dateFrom: string;
  dateTo: string;
  client: string;
  assignedTo: string;
}

export interface ApiQuote {
  _id: string;
  number: string;
  status: string;
  total: number;
  subtotal: number;
  validUntil?: string;
  title: string;
  description?: string;
  clientId?: any;
  leadId?: any;
  createdBy?: any;
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string;
  sentAt?: string;
  leadName?: string;
  leadStatus?: string;
  workOrderStatus?: string | null;
}

export interface ApiNegotiation {
  _id: string;
  status: string;
  quoteId?: string;
  leadId: any;
  counterOffers: any[];
  validUntil?: string;
  terms?: string;
  createdBy?: any;
  createdAt: string;
  updatedAt?: string;
}
