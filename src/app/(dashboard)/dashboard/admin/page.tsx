// ── Admin / Owner — visión CEO completa del negocio ────────

'use client';

import { useEffect, useState } from 'react';
import { MetricCard, KpiGrid, SectionHeader } from '@/dashboard/components';
import { ProgressWidget } from '@/dashboard/components/ProgressWidget';
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

  const slaPct = operations
    ? Math.round((operations.sla.onTime / Math.max(operations.sla.onTime + operations.sla.delayed, 1)) * 100)
    : 0;

  const completedPct = operations
    ? Math.round((operations.sla.onTime / Math.max(operations.sla.onTime + operations.sla.delayed, 1)) * 100)
    : 0;

  const totalQuotes = commercial
    ? commercial.quotesByStatus.reduce((a, b) => a + b.count, 0)
    : 0;

  const totalLeads = commercial
    ? commercial.leadsByStage.reduce((a, b) => a + b.count, 0)
    : 0;

  const maxTechLoad = operations
    ? Math.max(...operations.technicianLoad.map((t) => t.assignedCount), 1)
    : 1;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Panel de Administración</h1>
          <p className="text-sm text-gray-500 mt-1">Visión completa del negocio — todos los indicadores</p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* ─── Resumen General ─── */}
      <section>
        <SectionHeader title="Resumen General" subtitle="Indicadores clave del negocio en tiempo real" />
        <KpiGrid>
          <MetricCard label="Clientes" value={summary?.clients.total ?? '-'} loading={loading}
            trend={summary ? { direction: 'up', label: `${summary.clients.newThisMonth} nuevos este mes` } : undefined} />
          <MetricCard label="Órdenes Pendientes" value={summary?.workOrders.pending ?? '-'} loading={loading}
            trend={summary ? { direction: 'down', label: `${summary.workOrders.inProgress} en progreso` } : undefined} />
          <MetricCard label="Leads Nuevos" value={summary?.leads.new ?? '-'} loading={loading} />
          <MetricCard label="Contratos Activos" value={summary?.contracts.active ?? '-'} loading={loading} />
          <MetricCard label="Empleados" value={summary?.employees.total ?? '-'} loading={loading}
            trend={summary ? { direction: summary.employees.active < summary.employees.total ? 'down' : 'up', label: `${summary.employees.active} activos` } : undefined} />
          <MetricCard label="Pipeline Total" value={summary?.quotes.totalEstimatedValue ? `$${(summary.quotes.totalEstimatedValue / 1000).toFixed(0)}k` : '-'} loading={loading} />
        </KpiGrid>
      </section>

      {/* ─── Operaciones ─── */}
      <section>
        <SectionHeader title="Operaciones" subtitle="Rendimiento operativo del día" />
        <KpiGrid>
          <MetricCard label="Completadas Hoy" value={operations?.completedToday ?? '-'} loading={loading} />
          <MetricCard label="En Progreso" value={operations?.inProgressOrders ?? '-'} loading={loading} />
          <MetricCard label="Pendientes" value={summary?.workOrders.pending ?? '-'} loading={loading} />
          <MetricCard label="Próximos 7 días" value={operations?.upcomingSevenDays ?? '-'} loading={loading} />
        </KpiGrid>
      </section>

      {/* ─── SLA ─── */}
      <section>
        <SectionHeader title="Cumplimiento SLA" subtitle={`${operations?.sla.onTime ?? 0} a tiempo · ${operations?.sla.delayed ?? 0} retrasadas · promedio ${operations?.sla.avgResponseTimeHours?.toFixed(1) ?? '-'}h respuesta`} />
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold text-gray-700">Efectividad</span>
            <span className={`font-bold ${slaPct >= 85 ? 'text-success-600' : slaPct >= 70 ? 'text-warning-600' : 'text-danger-600'}`}>{slaPct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${slaPct >= 85 ? 'bg-success-500' : slaPct >= 70 ? 'bg-warning-500' : 'bg-danger-500'}`}
              style={{ width: `${slaPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>0%</span>
            <span>Objetivo 85%</span>
            <span>100%</span>
          </div>
        </div>
      </section>

      {/* ─── Carga de Técnicos ─── */}
      <section>
        <SectionHeader title="Carga de Técnicos" subtitle="Órdenes asignadas — monitorear sobrecarga" />
        {operations && operations.technicianLoad.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {operations.technicianLoad.map((t) => (
              <ProgressWidget
                key={t.techId}
                label={`${t.name} · ${t.assignedCount} órdenes`}
                value={(t.assignedCount / maxTechLoad) * 100}
                variant={t.assignedCount > 5 ? 'danger' : t.assignedCount > 3 ? 'warning' : 'info'}
              />
            ))}
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Sin datos de técnicos</p>
        )}
      </section>

      {/* ─── Comercial / Pipeline ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads por etapa */}
        <section>
          <SectionHeader title="Leads por Etapa" subtitle={`${totalLeads} leads activos en pipeline`} />
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            {commercial && commercial.leadsByStage.length > 0 ? (
              commercial.leadsByStage.map((stage) => {
                const pct = totalLeads > 0 ? Math.round((stage.count / totalLeads) * 100) : 0;
                return (
                  <div key={stage.stage}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize text-gray-700 font-medium">{stage.stage}</span>
                      <span className="text-gray-500">{stage.count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            ) : loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">Sin leads en pipeline</p>
            )}
          </div>
        </section>

        {/* Cotizaciones por estado */}
        <section>
          <SectionHeader title="Cotizaciones por Estado" subtitle={`${totalQuotes} cotizaciones totales`} />
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            {commercial && commercial.quotesByStatus.length > 0 ? (
              commercial.quotesByStatus.map((q) => {
                const pct = totalQuotes > 0 ? Math.round((q.count / totalQuotes) * 100) : 0;
                const colorMap: Record<string, string> = {
                  draft: 'bg-gray-400',
                  sent: 'bg-brand-400',
                  approved: 'bg-success-500',
                  rejected: 'bg-danger-500',
                };
                return (
                  <div key={q.status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize text-gray-700 font-medium">{q.status}</span>
                      <span className="text-gray-500">{q.count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${colorMap[q.status] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            ) : loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">Sin cotizaciones</p>
            )}
          </div>
        </section>
      </div>

      {/* ─── Top Clientes ─── */}
      <section>
        <SectionHeader title="Top Clientes por Facturación" subtitle="Clientes con mayor volumen cotizado" />
        {commercial && commercial.topClients.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {commercial.topClients.map((client, idx) => (
              <div key={client.clientId} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${idx === 0 ? 'bg-brand-600' : idx === 1 ? 'bg-gray-500' : 'bg-amber-600'}`}>
                  {idx + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{client.name}</p>
                  <p className="text-sm text-gray-500">${(client.totalQuoted / 1000).toFixed(0)}k cotizados</p>
                </div>
              </div>
            ))}
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Sin datos de clientes</p>
        )}
      </section>

      {/* ─── Contratos ─── */}
      <section>
        <SectionHeader title="Contratos y Equipos" subtitle="Estado de mantenciones y renovaciones" />
        <KpiGrid>
          <MetricCard label="Contratos Activos" value={contracts?.activeContracts ?? '-'} loading={loading} />
          <MetricCard label="Próximos a Vencer" value={contracts?.expiringNextMonth ?? '-'} loading={loading}
            trend={contracts && contracts.expiringNextMonth > 0 ? { direction: 'up', label: `${contracts.expiringNextMonth} en 30 días` } : undefined} />
          <MetricCard label="Mantenciones Próximas" value={contracts?.upcomingMaintenance ?? '-'} loading={loading} />
          <MetricCard label="Equipos en Contrato" value={contracts?.equipmentUnderContract ?? '-'} loading={loading} />
        </KpiGrid>
      </section>
    </div>
  );
}
