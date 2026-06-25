// ── Commercial / Sales — pipeline de ventas ─────────────────

'use client';

import { useEffect, useState } from 'react';
import { MetricCard, KpiGrid, SectionHeader } from '@/dashboard/components';
import { StatusBadge } from '@/dashboard/components/StatusBadge';
import { DateRangePicker } from '@/dashboard/components/DateRangePicker';
import { fetchSummary, fetchCommercial, fetchContracts } from '@/dashboard/services/client-index';
import type { SummaryResponse, CommercialResponse, ContractsResponse } from '@/dashboard/types/metrics';

export default function CommercialPage() {
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [commercial, setCommercial] = useState<CommercialResponse | null>(null);
  const [contracts, setContracts] = useState<ContractsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [s, co, ct] = await Promise.all([
          fetchSummary(),
          fetchCommercial(),
          fetchContracts(),
        ]);
        setSummary(s);
        setCommercial(co);
        setContracts(ct);
      } catch {
        // handled by empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const conversionRate = commercial
    ? commercial.leads.converted > 0
      ? Math.round((commercial.leads.converted / Math.max(commercial.leads.total, 1)) * 100)
      : summary?.leads.conversionRate ?? 0
    : 0;
  const approvalRate = commercial
    ? commercial.quotes.approved > 0
      ? Math.round((commercial.quotes.approved / Math.max(commercial.quotes.sent, 1)) * 100)
      : 0
    : 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Panel Comercial</h1>
          <p className="text-sm text-gray-500 mt-1">Pipeline de ventas y rendimiento</p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* ─── Leads ─── */}
      <section>
        <SectionHeader title="Leads" subtitle="Estado de los prospectos" />
        <KpiGrid>
          <MetricCard label="Nuevos" value={summary?.leads.new ?? '-'} loading={loading} />
          <MetricCard label="En Seguimiento" value={commercial?.leads.inProgress ?? '-'} loading={loading} />
          <MetricCard label="Convertidos" value={commercial?.leads.converted ?? '-'} loading={loading} />
          <MetricCard label="Tasa Conversión" value={`${conversionRate}%`} loading={loading}
            trend={conversionRate < 25 ? { direction: 'down', label: 'Baja' } : undefined} />
        </KpiGrid>
      </section>

      {/* ─── Cotizaciones ─── */}
      <section>
        <SectionHeader title="Cotizaciones" subtitle="Documentos comerciales" />
        <KpiGrid>
          <MetricCard label="Borrador" value={commercial?.quotes.draft ?? '-'} loading={loading} />
          <MetricCard label="Enviadas" value={commercial?.quotes.sent ?? '-'} loading={loading} />
          <MetricCard label="Aprobadas" value={commercial?.quotes.approved ?? '-'} loading={loading} />
          <MetricCard label="Rechazadas" value={commercial?.quotes.rejected ?? '-'} loading={loading} />
        </KpiGrid>
        {approvalRate > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Tasa de Aprobación</span>
              <span className="font-semibold text-gray-900">{approvalRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${approvalRate > 60 ? 'bg-success-500' : approvalRate > 30 ? 'bg-warning-500' : 'bg-danger-500'}`}
                style={{ width: `${approvalRate}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* ─── Contratos ─── */}
      <section>
        <SectionHeader title="Contratos" subtitle="Mantenciones y renovaciones" />
        <KpiGrid>
          <MetricCard label="Nuevos del Mes" value={commercial?.contracts.newThisMonth ?? '-'} loading={loading} />
          <MetricCard label="Activos" value={summary?.contracts.active ?? '-'} loading={loading} />
          <MetricCard label="Próximos a Vencer" value={contracts?.expiringNextMonth ?? '-'} loading={loading}
            trend={contracts && contracts.expiringNextMonth > 0 ? { direction: 'up', label: 'Oportunidad de renovación' } : undefined} />
        </KpiGrid>
      </section>

      {/* ─── Totales ─── */}
      <section>
        <SectionHeader title="Totales" subtitle="Clientes y equipos bajo gestión" />
        <KpiGrid>
          <MetricCard label="Clientes" value={summary?.clients.total ?? '-'} loading={loading} />
          <MetricCard label="Equipos en Contrato" value={contracts?.equipmentUnderContract ?? '-'} loading={loading} />
        </KpiGrid>
      </section>
    </div>
  );
}
