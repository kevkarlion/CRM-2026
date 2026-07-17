import type { LeadStatus } from '@/leads/types/lead';

export type { LeadStatus };

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  quote_sent: 'Presupuesto enviado',
  technical_visit: 'Visita técnica',
  negotiation: 'Negociación',
  won: 'Ganado',
  lost: 'Perdido',
  disqualified: 'Descalificado',
};

export const LEAD_STATUSES: LeadStatus[] = Object.keys(LEAD_STATUS_LABELS) as LeadStatus[];
