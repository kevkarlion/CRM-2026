// ── Supervisor — operaciones, SLA y carga de técnicos ──────

'use client';

import { useEffect, useState } from 'react';
import { MetricCard, KpiGrid, SectionHeader } from '@/dashboard/components';
import { ProgressWidget } from '@/dashboard/components/ProgressWidget';
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
          <p className="text-sm text-gray-500 mt-1">Operaciones, SLA y rendimiento de técnicos</p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* ─── Resumen Rápido ─── */}
      <section>
        <SectionHeader title="Estado del Día" subtitle="Resumen operativo en tiempo real" />
        <KpiGrid>
          <MetricCard label="Órdenes Pendientes" value={summary?.workOrders.pending ?? '-'} loading={loading} />
          <MetricCard label="En Progreso" value={operations?.inProgressOrders ?? '-'} loading={loading} />
          <MetricCard label="Completadas Hoy" value={operations?.completedToday ?? '-'} loading={loading}
            trend={operations && operations.completedToday > 0 ? { direction: 'up', label: 'Hoy' } : undefined} />
          <MetricCard label="Próximos 7 días" value={operations?.upcomingSevenDays ?? '-'} loading={loading} />
        </KpiGrid>
      </section>

      {/* ─── SLA ─── */}
      <section>
        <SectionHeader title="Cumplimiento SLA" subtitle="Órdenes dentro del tiempo acordado" />
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Efectividad general</span>
            <span className={`font-bold text-lg ${slaPct >= 85 ? 'text-success-600' : slaPct >= 70 ? 'text-warning-600' : 'text-danger-600'}`}>
              {slaPct}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className={`h-3 rounded-full transition-all ${slaPct >= 85 ? 'bg-success-500' : slaPct >= 70 ? 'bg-warning-500' : 'bg-danger-500'}`}
              style={{ width: `${slaPct}%` }}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-success-600">{operations?.sla.onTime ?? '-'}</div>
              <p className="text-xs text-gray-500 mt-1">A Tiempo</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-danger-600">{operations?.sla.delayed ?? '-'}</div>
              <p className="text-xs text-gray-500 mt-1">Retrasadas</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-700">{operations?.sla.avgResponseTimeHours?.toFixed(1) ?? '-'}</div>
              <p className="text-xs text-gray-500 mt-1">Horas Respuesta</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-700">{summary?.workOrders.completedThisMonth ?? '-'}</div>
              <p className="text-xs text-gray-500 mt-1">Completadas Mes</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Carga de Técnicos ─── */}
      <section>
        <SectionHeader title="Carga de Técnicos" subtitle="Órdenes asignadas — monitorear sobrecarga" />
        {operations && operations.technicianLoad.length > 0 ? (
          <div className="space-y-2">
            {operations.technicianLoad.map((t) => (
              <div key={t.techId} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold text-gray-700">{t.name}</span>
                  <span className={`text-sm font-medium ${t.assignedCount > 5 ? 'text-danger-600' : t.assignedCount > 3 ? 'text-warning-600' : 'text-gray-500'}`}>
                    {t.assignedCount} órdenes
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${t.assignedCount > 5 ? 'bg-danger-500' : t.assignedCount > 3 ? 'bg-warning-500' : 'bg-success-500'}`}
                    style={{ width: `${(t.assignedCount / maxLoad) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Sin datos de técnicos</p>
        )}
      </section>

      {/* ─── Contratos ─── */}
      <section>
        <SectionHeader title="Contratos Próximos a Vencer" subtitle="Renovaciones que requieren atención" />
        <KpiGrid>
          <MetricCard label="Próximos a Vencer" value={contracts?.expiringNextMonth ?? '-'} loading={loading}
            trend={contracts && contracts.expiringNextMonth > 0 ? { direction: 'up', label: `${contracts.expiringNextMonth} en 30 días` } : undefined} />
          <MetricCard label="Mantenciones Próximas" value={contracts?.upcomingMaintenance ?? '-'} loading={loading} />
          <MetricCard label="Contratos Activos" value={contracts?.activeContracts ?? '-'} loading={loading} />
          <MetricCard label="Equipos en Contrato" value={contracts?.equipmentUnderContract ?? '-'} loading={loading} />
        </KpiGrid>
        {contracts && contracts.expiringNextMonth > 0 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            ⚠ {contracts.expiringNextMonth} contratos próximos a vencer — coordinar renovaciones
          </div>
        )}
      </section>
    </div>
  );
}
