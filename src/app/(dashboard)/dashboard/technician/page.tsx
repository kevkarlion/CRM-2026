// ── Technician — mi panel operativo ────────────────────────

'use client';

import { useEffect, useState } from 'react';
import { MetricCard, KpiGrid, SectionHeader } from '@/dashboard/components';
import { ProgressWidget } from '@/dashboard/components/ProgressWidget';
import { DateRangePicker } from '@/dashboard/components/DateRangePicker';
import { fetchOperations, fetchContracts } from '@/dashboard/services/client-index';
import type { OperationsResponse, ContractsResponse } from '@/dashboard/types/metrics';

export default function TechnicianPage() {
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [operations, setOperations] = useState<OperationsResponse | null>(null);
  const [contracts, setContracts] = useState<ContractsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [o, c] = await Promise.all([
          fetchOperations(),
          fetchContracts(),
        ]);
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

  const myLoad = operations?.technicianLoad[0];
  const maxLoad = operations ? Math.max(...operations.technicianLoad.map((t) => t.assignedCount), 1) : 1;
  const slaPct = operations
    ? Math.round((operations.sla.onTime / Math.max(operations.sla.onTime + operations.sla.delayed, 1)) * 100)
    : 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mi Panel</h1>
          <p className="text-sm text-gray-500 mt-1">Hola{myLoad ? `, ${myLoad.name.split(' ')[0]}` : ''} — este es tu resumen del día</p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* ─── Mi Día ─── */}
      <section>
        <SectionHeader title="Resumen del Día" subtitle="Tu carga de trabajo actual" />
        <KpiGrid>
          <MetricCard label="Órdenes Asignadas" value={myLoad?.assignedCount ?? '-'} loading={loading} />
          <MetricCard label="Completadas Hoy" value={operations?.completedToday ?? '-'} loading={loading}
            trend={operations && operations.completedToday > 0 ? { direction: 'up', label: 'Hoy' } : undefined} />
          <MetricCard label="Próximos 7 días" value={operations?.upcomingSevenDays ?? '-'} loading={loading} />
        </KpiGrid>
      </section>

      {/* ─── Mi Carga ─── */}
      <section>
        <SectionHeader title="Mi Carga de Trabajo" subtitle="Nivel de ocupación actual" />
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          {myLoad ? (
            <>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-gray-600">Nivel de ocupación</span>
                <span className={`text-lg font-bold ${myLoad.assignedCount > 5 ? 'text-danger-600' : myLoad.assignedCount > 3 ? 'text-warning-600' : 'text-success-600'}`}>
                  {myLoad.assignedCount} / {maxLoad}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className={`h-4 rounded-full transition-all ${myLoad.assignedCount > 5 ? 'bg-danger-500' : myLoad.assignedCount > 3 ? 'bg-warning-500' : 'bg-success-500'}`}
                  style={{ width: `${(myLoad.assignedCount / maxLoad) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {myLoad.assignedCount > 5 ? '⚠ Carga alta — priorizar tareas críticas' :
                 myLoad.assignedCount > 3 ? '⚡ Carga moderada — rendimiento estable' :
                 '✅ Carga baja — disponibilidad para nuevas tareas'}
              </p>
            </>
          ) : loading ? (
            <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">Sin datos de carga</p>
          )}
        </div>
      </section>

      {/* ─── SLA Personal ─── */}
      <section>
        <SectionHeader title="Mi Rendimiento SLA" subtitle="Órdenes completadas a tiempo" />
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold text-gray-700">Efectividad</span>
            <span className={`font-bold text-lg ${slaPct >= 85 ? 'text-success-600' : slaPct >= 70 ? 'text-warning-600' : 'text-danger-600'}`}>{slaPct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className={`h-3 rounded-full transition-all ${slaPct >= 85 ? 'bg-success-500' : slaPct >= 70 ? 'bg-warning-500' : 'bg-danger-500'}`}
              style={{ width: `${slaPct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-success-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-success-600">{operations?.sla.onTime ?? '-'}</div>
              <p className="text-xs text-gray-500 mt-1">A tiempo</p>
            </div>
            <div className="bg-danger-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-danger-600">{operations?.sla.delayed ?? '-'}</div>
              <p className="text-xs text-gray-500 mt-1">Retrasadas</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Órdenes ─── */}
      <section>
        <SectionHeader title="Órdenes en Progreso" subtitle="Tareas activas actualmente" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-gray-900">{operations?.inProgressOrders ?? '-'}</div>
            <p className="text-xs text-gray-500 mt-1">En progreso</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-gray-900">{operations?.completedToday ?? '-'}</div>
            <p className="text-xs text-gray-500 mt-1">Completadas hoy</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-gray-900">{operations?.pendingOrders ?? '-'}</div>
            <p className="text-xs text-gray-500 mt-1">Pendientes</p>
          </div>
        </div>
      </section>

      {/* ─── Mantenciones ─── */}
      <section>
        <SectionHeader title="Mantenciones Programadas" subtitle="Visitas agendadas próximamente" />
        <KpiGrid>
          <MetricCard label="Próximos 30 días" value={contracts?.upcomingMaintenance ?? '-'} loading={loading} />
          <MetricCard label="Equipos a Cargo" value={contracts?.equipmentUnderContract ?? '-'} loading={loading} />
          <MetricCard label="Contratos Activos" value={contracts?.activeContracts ?? '-'} loading={loading} />
        </KpiGrid>
      </section>
    </div>
  );
}
