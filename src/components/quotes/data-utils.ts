import type { QuoteTableRow, ApiQuote, ApiNegotiation, ApiTechnicalVisit } from '@/quotes/types/client-quote-types';

const VISIT_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  in_progress: 'En Curso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  converted_to_work_order: 'Convertida a OT',
};

function mapQuoteToRow(quote: ApiQuote): QuoteTableRow {
  const clientName = quote.leadName || (quote.clientId
    ? typeof quote.clientId === 'object' && quote.clientId !== null
      ? (quote.clientId as any).fullName || (quote.clientId as any).companyName || '—'
      : '—'
    : '—');

  const assignedName = quote.createdBy
    ? typeof quote.createdBy === 'object' && quote.createdBy !== null
      ? (quote.createdBy as any).name || (quote.createdBy as any).email || '—'
      : '—'
    : '—';

  return {
    id: quote._id,
    entityType: 'quote',
    clientName,
    companyName: clientName,
    status: quote.status,
    total: quote.total ?? null,
    validUntil: quote.validUntil ?? null,
    nextAction: 'none',
    assignedName,
    createdAt: quote.createdAt,
    entityStatus: quote.status,
    workOrderStatus: (quote as any).workOrderStatus ?? null,
    leadStatus: (quote as any).leadStatus ?? null,
  };
}

function mapNegotiationToRow(neg: ApiNegotiation): QuoteTableRow {
  const clientName = neg.leadId
    ? typeof neg.leadId === 'object' && neg.leadId !== null
      ? (neg.leadId as any).name || (neg.leadId as any).companyName || '—'
      : '—'
    : '—';

  const assignedName = neg.createdBy
    ? typeof neg.createdBy === 'object' && neg.createdBy !== null
      ? (neg.createdBy as any).name || (neg.createdBy as any).email || '—'
      : '—'
    : '—';

  const total = neg.counterOffers && neg.counterOffers.length > 0
    ? neg.counterOffers[neg.counterOffers.length - 1].amount ?? null
    : null;

  return {
    id: neg._id,
    entityType: 'negotiation',
    clientName,
    companyName: clientName,
    status: neg.status,
    total,
    validUntil: neg.validUntil ?? null,
    nextAction: 'none',
    assignedName,
    createdAt: neg.createdAt,
    entityStatus: neg.status,
  };
}

function mapVisitToRow(visit: ApiTechnicalVisit): QuoteTableRow {
  const clientName = visit.clientSnapshot?.name || '—';

  const assignedName = visit.createdBy
    ? typeof visit.createdBy === 'object' && visit.createdBy !== null
      ? (visit.createdBy as any).name || (visit.createdBy as any).email || '—'
      : '—'
    : '—';

  return {
    id: visit._id,
    entityType: 'technical_visit',
    clientName,
    companyName: clientName,
    status: VISIT_STATUS_LABELS[visit.status] || visit.status,
    total: null,
    validUntil: visit.scheduledDate ?? null,
    nextAction: 'none',
    assignedName,
    createdAt: visit.createdAt,
    entityStatus: visit.status,
  };
}

export function mergeQuotesAndNegotiations(
  quotes: ApiQuote[],
  negotiations: ApiNegotiation[],
  visits?: ApiTechnicalVisit[],
): QuoteTableRow[] {
  const quoteRows = quotes.map(mapQuoteToRow);
  const negRows = negotiations.map(mapNegotiationToRow);
  const visitRows = (visits || []).map(mapVisitToRow);

  const merged = [...quoteRows, ...negRows, ...visitRows];
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return merged;
}
