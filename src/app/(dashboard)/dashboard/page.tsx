// ── Overview dashboard — resumen ejecutivo ─────────────────

'use client';

import { useEffect, useState } from 'react';
import { MetricCard, KpiGrid, SectionHeader } from '@/dashboard/components';
import { StatusBadge } from '@/dashboard/components/StatusBadge';
import { ProgressWidget } from '@/dashboard/components/ProgressWidget';
import { ListCard } from '@/dashboard/components/ListCard';
import { fetchSummary, fetchOperations, fetchContracts } from '@/dashboard/services/client-index';
import type { SummaryResponse, OperationsResponse, ContractsResponse } from '@/dashboard/types/metrics';

export default function OverviewPage() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [operations, setOperations] = useState<OperationsResponse | null>(null);
  const [contracts, setContracts] = useState<ContractsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [s, o, c] = await Promise.all([
          fetchSummary(),
          fetchOperations(),
          fetchContracts(),
        ]);
        setSummary(s);
        setOperations(o);
        setContracts(c);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-danger-500 font-medium mb-2">Error</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── KPI Summary ── */}
      <section>
        <SectionHeader title="Resumen Ejecutivo" subtitle="Indicadores clave del negocio" />
        <KpiGrid>
          <MetricCard label="Clientes" value={summary?.clients.total ?? '-'} loading={loading} />
          <MetricCard
            label="Órdenes Pendientes"
            value={summary?.workOrders.pending ?? '-'}
            loading={loading}
            trend={summary ? { direction: summary.workOrders.pending > 5 ? 'up' : 'down', label: `${summary.workOrders.pending} pendientes` } : undefined}
          />
          <MetricCard label="Leads Nuevos" value={summary?.leads.new ?? '-'} loading={loading} />
          <MetricCard label="Contratos Activos" value={summary?.contracts.active ?? '-'} loading={loading} />
        </KpiGrid>
      </section>

      {/* ── Operaciones ── */}
      <section>
        <SectionHeader
          title="Operaciones"
          subtitle={operations ? `Hoy: ${operations.completedToday} completadas` : undefined}
        />
        <div className="metric-grid">
          <MetricCard label="En Progreso" value={operations?.inProgressOrders ?? '-'} loading={loading} />
          <MetricCard label="Próximos 7 días" value={operations?.upcomingSevenDays ?? '-'} loading={loading} />
          <MetricCard label="Cumplimiento SLA" value={operations ? `${Math.round((operations.sla.onTime / Math.max(operations.sla.onTime + operations.sla.delayed, 1)) * 100)}%` : '-'} loading={loading} />
        </div>

        {operations && operations.technicianLoad.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {operations.technicianLoad.map((t) => (
              <ProgressWidget
                key={t.techId}
                label={t.name}
                value={Math.min(100, (t.assignedCount / Math.max(...operations.technicianLoad.map((x) => x.assignedCount))) * 100)}
                variant={t.assignedCount > 5 ? 'warning' : 'info'}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Contratos ── */}
      <section>
        <SectionHeader title="Contratos" subtitle="Estado de mantenciones y equipos" />
        <div className="metric-grid">
          <MetricCard label="Próximos a Venecer" value={contracts?.expiringNextMonth ?? '-'} loading={loading} trend={contracts && contracts.expiringNextMonth > 0 ? { direction: 'up', label: `${contracts.expiringNextMonth} en 30 días` } : undefined} />
          <MetricCard label="Mantenciones Próximas" value={contracts?.upcomingMaintenance ?? '-'} loading={loading} />
          <MetricCard label="Equipos en Contrato" value={contracts?.equipmentUnderContract ?? '-'} loading={loading} />
        </div>
      </section>

      {/* ── Comercial indicator ── */}
      {summary && (
        <section>
          <SectionHeader title="Comercial" subtitle="Pipeline de ventas" />
          <div className="metric-grid">
            <MetricCard label="Cotizaciones Enviadas" value={summary.quotes.sent} />
            <MetricCard label="Aprobadas" value={summary.quotes.approved} />
            <MetricCard label="Tasa Conversión Leads" value={`${summary.leads.conversionRate}%`} />
          </div>
        </section>
      )}
    </div>
  );
}
