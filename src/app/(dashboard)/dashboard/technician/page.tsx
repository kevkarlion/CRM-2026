// ── Technician — órdenes y visitas asignadas ────────────────

'use client';

import { useEffect, useState } from 'react';
import { MetricCard, KpiGrid, SectionHeader } from '@/dashboard/components';
import { StatusBadge } from '@/dashboard/components/StatusBadge';
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

  // Simulate the current technician from the first load entry
  const myLoad = operations?.technicianLoad[0];
  const slaPct = operations
    ? Math.round((operations.sla.onTime / Math.max(operations.sla.onTime + operations.sla.delayed, 1)) * 100)
    : 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mi Panel</h1>
          <p className="text-sm text-gray-500 mt-1">Órdenes y visitas asignadas</p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* ─── Mi Carga ─── */}
      <section>
        <SectionHeader title="Mi Carga de Trabajo" subtitle="Órdenes asignadas hoy" />
        <KpiGrid>
          <MetricCard label="Completadas Hoy" value={operations?.completedToday ?? '-'} loading={loading} />
          <MetricCard label="Mis Órdenes" value={myLoad?.assignedCount ?? '-'} loading={loading} />
          <MetricCard label="Próximos 7 días" value={operations?.upcomingSevenDays ?? '-'} loading={loading} />
          <MetricCard label="SLA" value={`${slaPct}%`} loading={loading}
            trend={slaPct < 85 ? { direction: 'down', label: 'Cumplir metas' } : undefined} />
        </KpiGrid>
      </section>

      {/* ─── Órdenes ─── */}
      <section>
        <SectionHeader title="Órdenes en Progreso" subtitle="Tareas activas" />
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-2">{operations?.inProgressOrders ?? '-'}</div>
          <p className="text-sm text-gray-500">órdenes en progreso actualmente</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-success-600">{operations?.sla.onTime ?? '-'}</div>
            <p className="text-xs text-gray-500 mt-1">A tiempo</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-danger-600">{operations?.sla.delayed ?? '-'}</div>
            <p className="text-xs text-gray-500 mt-1">Retrasadas</p>
          </div>
        </div>
      </section>

      {/* ─── Próximas Mantenciones ─── */}
      <section>
        <SectionHeader title="Mantenciones Programadas" subtitle="Visitas agendadas" />
        <KpiGrid>
          <MetricCard label="Próximos 30 días" value={contracts?.upcomingMaintenance ?? '-'} loading={loading} />
          <MetricCard label="Equipos a Cargo" value={contracts?.equipmentUnderContract ?? '-'} loading={loading} />
        </KpiGrid>
      </section>
    </div>
  );
}
