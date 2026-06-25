// ── Supervisor — operaciones, SLA y carga de técnicos ──────

'use client';

import { useEffect, useState } from 'react';
import { MetricCard, KpiGrid, SectionHeader } from '@/dashboard/components';
import { StatusBadge } from '@/dashboard/components/StatusBadge';
import { ProgressWidget } from '@/dashboard/components/ProgressWidget';
import { ListCard } from '@/dashboard/components/ListCard';
import { DateRangePicker } from '@/dashboard/components/DateRangePicker';
import { fetchSummary, fetchOperations, fetchContracts } from '@/dashboard/services/client-index';
import type { SummaryResponse, OperationsResponse, ContractsResponse } from '@/dashboard/types/metrics';

export default function SupervisorPage() {
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [operations, setOperations] = useState<OperationsResponse | null>(null);
  const [contracts, setContracts] = useState<ContractsResponse | null>(null);
  const [loading, setLoading] = useState(true);

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
      } catch {
        // handled by empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const slaPct = operations
    ? Math.round((operations.sla.onTime / Math.max(operations.sla.onTime + operations.sla.delayed, 1)) * 100)
    : 0;
  const maxLoad = operations ? Math.max(...operations.technicianLoad.map((t) => t.assignedCount), 1) : 1;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Panel de Supervisor</h1>
          <p className="text-sm text-gray-500 mt-1">Operaciones y rendimiento de técnicos</p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* ─── KPIs Rápidos ─── */}
      <section>
        <SectionHeader title="Resumen de Operaciones" subtitle="Estado actual del día" />
        <KpiGrid>
          <MetricCard label="Órdenes Pendientes" value={summary?.workOrders.pending ?? '-'} loading={loading} />
          <MetricCard label="Completadas Hoy" value={operations?.completedToday ?? '-'} loading={loading} />
          <MetricCard label="En Progreso" value={operations?.inProgressOrders ?? '-'} loading={loading} />
          <MetricCard label="Próximos 7 días" value={operations?.upcomingSevenDays ?? '-'} loading={loading} />
        </KpiGrid>
      </section>

      {/* ─── SLA ─── */}
      <section>
        <SectionHeader title="Cumplimiento SLA" subtitle="Órdenes dentro del tiempo acordado" />
        <div className="metric-grid">
          <MetricCard label="A Tiempo" value={operations?.sla.onTime ?? '-'} loading={loading} />
          <MetricCard label="Retrasadas" value={operations?.sla.delayed ?? '-'} loading={loading}
            trend={operations && operations.sla.delayed > 0 ? { direction: 'up', label: `${operations.sla.delayed} retrasadas` } : undefined} />
          <MetricCard label="Efectividad" value={`${slaPct}%`} loading={loading}
            trend={slaPct < 85 ? { direction: 'down', label: 'Requiere atención' } : undefined} />
        </div>
      </section>

      {/* ─── Carga de Técnicos ─── */}
      <section>
        <SectionHeader title="Carga de Técnicos" subtitle="Órdenes asignadas por técnico" />
        {operations && operations.technicianLoad.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {operations.technicianLoad.map((t) => (
              <ProgressWidget
                key={t.techId}
                label={`${t.name} (${t.assignedCount} órdenes)`}
                value={Math.min(100, (t.assignedCount / maxLoad) * 100)}
                variant={t.assignedCount > 5 ? 'warning' : t.assignedCount > 8 ? 'danger' : 'info'}
              />
            ))}
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Sin datos de técnicos</p>
        )}
      </section>

      {/* ─── Contratos próximos ─── */}
      <section>
        <SectionHeader title="Contratos Próximos a Vencer" subtitle="Renovaciones que requieren atención" />
        <div className="metric-grid">
          <MetricCard label="Próximos a Vencer" value={contracts?.expiringNextMonth ?? '-'} loading={loading}
            trend={contracts && contracts.expiringNextMonth > 0 ? { direction: 'up', label: 'Requiere acción' } : undefined} />
          <MetricCard label="Mantenciones Próximas" value={contracts?.upcomingMaintenance ?? '-'} loading={loading} />
        </div>
      </section>
    </div>
  );
}
