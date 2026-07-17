'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { ExecutiveSummary } from '@/components/quotes/executive-summary';
import { WorkTray } from '@/components/quotes/work-tray';
import { QuickActions } from '@/components/quotes/quick-actions';
import { FilterBar } from '@/components/quotes/filter-bar';
import { SmartTable } from '@/components/quotes/smart-table';
import { SmartTableRow } from '@/components/quotes/smart-table-row';
import { mergeQuotesAndNegotiations } from '@/components/quotes/data-utils';
import { getNextAction } from '@/components/quotes/next-action-badge';
import type {
  QuoteTableRow,
  QuoteSummaryStats,
  WorkTrayItem,
  FilterState,
  ApiQuote,
  ApiNegotiation,
} from '@/quotes/types/client-quote-types';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  expired: 'Vencida',
  cancelled: 'Cancelada',
  open: 'Abierta',
  counteroffer_made: 'Contraoferta',
  accepted: 'Aceptada',
};

function buildWorkTrayItems(quotes: ApiQuote[], negotiations: ApiNegotiation[]): WorkTrayItem[] {
  const items: WorkTrayItem[] = [];
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  quotes
    .filter(q => q.status === 'sent' && q.validUntil)
    .forEach(q => {
      const vu = new Date(q.validUntil!);
      if (vu >= now && vu <= sevenDays) {
        items.push({
          id: q._id,
          entityType: 'quote',
          clientName: q.title || q.number,
          category: 'expiring',
          validUntil: q.validUntil,
          status: q.status,
          total: q.total,
        });
      }
    });

  negotiations
    .filter(n => n.status === 'counteroffer_made')
    .forEach(n => {
      const clientName = n.leadId
        ? typeof n.leadId === 'object' && n.leadId !== null
          ? (n.leadId as any).name || (n.leadId as any).companyName || '—'
          : '—'
        : '—';
      items.push({
        id: n._id,
        entityType: 'negotiation',
        clientName,
        category: 'awaiting',
        status: n.status,
      });
    });

  quotes
    .filter(q => q.status === 'approved' && q.updatedAt)
    .forEach(q => {
      const updatedAt = new Date(q.updatedAt!);
      if (updatedAt >= oneDayAgo) {
        items.push({
          id: q._id,
          entityType: 'quote',
          clientName: q.title || q.number,
          category: 'recently_approved',
          status: q.status,
          total: q.total,
        });
      }
    });

  return items;
}

interface CentroOperativoContentProps {
  initialFilters: FilterState;
}

export default function CentroOperativoContent({ initialFilters }: CentroOperativoContentProps) {
  const router = useRouter();

  const [quotes, setQuotes] = useState<ApiQuote[]>([]);
  const [negotiations, setNegotiations] = useState<ApiNegotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // initialFilters proviene del Server Component → misma serialización en SSR e hidratación
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  // Sincroniza filtros cuando searchParams cambian por navegación cliente
  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const quotesParams: Record<string, string> = { limit: '50' };
      if (filters.status.length > 0) {
        quotesParams.status = filters.status.join(',');
      }
      if (filters.dateFrom) quotesParams.dateFrom = filters.dateFrom;
      if (filters.dateTo) quotesParams.dateTo = filters.dateTo;

      const quotesResult = await api.get<any>('/api/crm/quotes', quotesParams);
      const quotesData = Array.isArray(quotesResult)
        ? quotesResult
        : (quotesResult as any)?.data || [];
      setQuotes(quotesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar cotizaciones');
    }

    try {
      const negsResult = await api.get<any>('/api/crm/negotiations', { limit: '50' });
      const negsData = Array.isArray(negsResult) ? negsResult : [];
      setNegotiations(negsData);
    } catch {
      // Negotiations endpoint may not be available — graceful degradation
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rows = useMemo((): QuoteTableRow[] => {
    const merged = mergeQuotesAndNegotiations(quotes, negotiations);
    return merged
      .filter(row => {
        if (filters.client && !row.clientName.toLowerCase().includes(filters.client.toLowerCase())) {
          return false;
        }
        if (filters.assignedTo && !row.assignedName.toLowerCase().includes(filters.assignedTo.toLowerCase())) {
          return false;
        }
        return true;
      })
      .map(row => ({
        ...row,
        nextAction: getNextAction({
          status: row.entityStatus,
          entityType: row.entityType,
          validUntil: row.validUntil,
          workOrderStatus: row.workOrderStatus,
          leadStatus: row.leadStatus,
        }).type,
      }));
  }, [quotes, negotiations, filters.client, filters.assignedTo]);

  const summary = useMemo((): QuoteSummaryStats => {
    const sent = quotes.filter(q => q.status === 'sent').length;
    const approved = quotes.filter(q => q.status === 'approved').length;
    const rejected = quotes.filter(q => q.status === 'rejected').length;
    const denominator = sent + approved + rejected;

    return {
      activeQuotes: quotes.filter(q => q.status === 'draft' || q.status === 'sent').length,
      pendingNegotiations: negotiations.filter(n => n.status === 'open' || n.status === 'counteroffer_made').length,
      conversionRate: denominator > 0 ? Math.round((approved / denominator) * 100) : 0,
      totalPotentialValue: quotes
        .filter(q => q.status === 'draft' || q.status === 'sent')
        .reduce((sum, q) => sum + (q.total || 0), 0),
    };
  }, [quotes, negotiations]);

  const workTrayItems = useMemo(() => buildWorkTrayItems(quotes, negotiations), [quotes, negotiations]);

  function handleFilterChange(newFilters: FilterState) {
    setFilters(newFilters);
    const params = new URLSearchParams();
    if (newFilters.status.length > 0) params.set('status', newFilters.status.join(','));
    if (newFilters.dateFrom) params.set('dateFrom', newFilters.dateFrom);
    if (newFilters.dateTo) params.set('dateTo', newFilters.dateTo);
    if (newFilters.client) params.set('client', newFilters.client);
    if (newFilters.assignedTo) params.set('assigned', newFilters.assignedTo);
    router.replace(`/quotes?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Centro Operativo Comercial</h1>
        <p className="text-sm text-gray-500 mt-1">
          {loading ? 'Cargando...' : `${rows.length} documentos`}
        </p>
      </div>

      <ExecutiveSummary stats={summary} loading={loading} />
      <WorkTray items={workTrayItems} loading={loading} />
      <QuickActions />
      <FilterBar filters={filters} onChange={handleFilterChange} />

      <SmartTable
        rows={rows}
        loading={loading}
        error={error || undefined}
        onRetry={fetchData}
      >
        {rows.map(row => (
          <SmartTableRow key={`${row.entityType}-${row.id}`} row={row} />
        ))}
      </SmartTable>
    </div>
  );
}
