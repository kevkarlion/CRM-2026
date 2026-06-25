// ── Admin / Owner — visión completa del negocio ─────────────

'use client';

import { useEffect, useState } from 'react';
import { MetricCard, KpiGrid, SectionHeader } from '@/dashboard/components';
import { StatusBadge } from '@/dashboard/components/StatusBadge';
import { ProgressWidget } from '@/dashboard/components/ProgressWidget';
import { ListCard } from '@/dashboard/components/ListCard';
import { DateRangePicker } from '@/dashboard/components/DateRangePicker';
import { fetchSummary, fetchOperations, fetchCommercial, fetchContracts } from '@/dashboard/services/client-index';
import type { SummaryResponse, OperationsResponse, CommercialResponse, ContractsResponse } from '@/dashboard/types/metrics';

export default function AdminPage() {
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [operations, setOperations] = useState<OperationsResponse | null>(null);
  const [commercial, setCommercial] = useState<CommercialResponse | null>(null);
  const [contracts, setContracts] = useState<ContractsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [s, o, co, ct] = await Promise.all([
          fetchSummary(),
          fetchOperations(),
          fetchCommercial(),
          fetchContracts(),
        ]);
        setSummary(s);
        setOperations(o);
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

  const completedPct = operations
    ? Math.round((operations.completedToday / Math.max(operations.completedToday + operations.inProgressOrders, 1)) * 100)
    : 0;
  const slaPct = operations
    ? Math.round((operations.sla.onTime / Math.max(operations.sla.onTime + operations.sla.delayed, 1)) * 100)
    : 0;
  const conversionRate = summary ? summary.leads.conversionRate : 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Panel de Administración</h1>
          <p className="text-sm text-gray-500 mt-1">Visión completa del negocio</p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* ─── KPIs Principales ─── */}
      <section>
        <SectionHeader title="Resumen General" subtitle="Indicadores clave del negocio" />
        <KpiGrid>
          <MetricCard label="Clientes" value={summary?.clients.total ?? '-'} loading={loading} />
          <MetricCard label="Órdenes Pendientes" value={summary?.workOrders.pending ?? '-'} loading={loading}
            trend={summary ? { direction: summary.workOrders.pending > 5 ? 'up' : 'down', label: `${summary.workOrders.pending} pendientes` } : undefined} />
          <MetricCard label="Leads Nuevos" value={summary?.leads.new ?? '-'} loading={loading} />
          <MetricCard label="Contratos Activos" value={summary?.contracts.active ?? '-'} loading={loading} />
          <MetricCard label="Empleados" value={summary?.employees.total ?? '-'} loading={loading}
            trend={summary ? { direction: summary.employees.active < summary.employees.total ? 'down' : 'up', label: `${summary.employees.active} activos` } : undefined} />
        </KpiGrid>
      </section>

      {/* ─── Operaciones ─── */}
      <section>
        <SectionHeader title="Operaciones" subtitle="Rendimiento operativo del día" />
        <KpiGrid>
          <MetricCard label="Completadas Hoy" value={operations?.completedToday ?? '-'} loading={loading} />
          <MetricCard label="En Progreso" value={operations?.inProgressOrders ?? '-'} loading={loading} />
          <MetricCard label="Próximos 7 días" value={operations?.upcomingSevenDays ?? '-'} loading={loading} />
          <MetricCard label="Cumplimiento" value={`${completedPct}%`} loading={loading} />
          <MetricCard label="SLA On Time" value={`${slaPct}%`} loading={loading}
            trend={slaPct < 80 ? { direction: 'down', label: 'Por debajo del objetivo' } : undefined} />
        </KpiGrid>

        {operations && operations.technicianLoad.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Carga de Técnicos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {operations.technicianLoad.map((t) => {
                const maxCount = Math.max(...operations.technicianLoad.map((x) => x.assignedCount));
                return (
                  <ProgressWidget
                    key={t.techId}
                    label={t.name}
                    value={maxCount > 0 ? (t.assignedCount / maxCount) * 100 : 0}
                    variant={t.assignedCount > 5 ? 'warning' : 'info'}
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ─── Comercial ─── */}
      <section>
        <SectionHeader title="Comercial" subtitle="Pipeline de ventas" />
        <KpiGrid>
          <MetricCard label="Leads Totales" value={commercial?.leads.total ?? '-'} loading={loading} />
          <MetricCard label="Cotizaciones Enviadas" value={commercial?.quotes.sent ?? '-'} loading={loading} />
          <MetricCard label="Aprobadas" value={commercial?.quotes.approved ?? '-'} loading={loading} />
          <MetricCard label="Tasa Conversión" value={`${conversionRate}%`} loading={loading}
            trend={conversionRate < 30 ? { direction: 'down', label: 'Baja conversión' } : undefined} />
          <MetricCard label="Contratos Nuevos" value={commercial?.contracts.newThisMonth ?? '-'} loading={loading} />
        </KpiGrid>
      </section>

      {/* ─── Contratos ─── */}
      <section>
        <SectionHeader title="Contratos y Equipos" subtitle="Estado de mantenciones" />
        <KpiGrid>
          <MetricCard label="Próximos a Vencer" value={contracts?.expiringNextMonth ?? '-'} loading={loading}
            trend={contracts && contracts.expiringNextMonth > 3 ? { direction: 'up', label: `${contracts.expiringNextMonth} en 30 días` } : undefined} />
          <MetricCard label="Mantenciones Próximas" value={contracts?.upcomingMaintenance ?? '-'} loading={loading} />
          <MetricCard label="Equipos en Contrato" value={contracts?.equipmentUnderContract ?? '-'} loading={loading} />
        </KpiGrid>
      </section>
    </div>
  );
}
