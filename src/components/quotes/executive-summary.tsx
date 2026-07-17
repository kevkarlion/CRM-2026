'use client';

import { IndicatorCard } from './indicator-card';
import type { QuoteSummaryStats } from '@/quotes/types/client-quote-types';

function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value);
}

interface ExecutiveSummaryProps {
  stats: QuoteSummaryStats | null;
  loading: boolean;
}

export function ExecutiveSummary({ stats, loading }: ExecutiveSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <IndicatorCard
        label="Cotizaciones activas"
        value={stats?.activeQuotes ?? 0}
        loading={loading}
      />
      <IndicatorCard
        label="Negociaciones pendientes"
        value={stats?.pendingNegotiations ?? 0}
        loading={loading}
      />
      <IndicatorCard
        label="Tasa de conversión"
        value={stats && stats.conversionRate != null
          ? `${Math.round(stats.conversionRate)}%`
          : '—'}
        loading={loading}
      />
      <IndicatorCard
        label="Valor potencial total"
        value={stats && stats.totalPotentialValue != null
          ? formatCLP(stats.totalPotentialValue)
          : '—'}
        loading={loading}
      />
    </div>
  );
}
