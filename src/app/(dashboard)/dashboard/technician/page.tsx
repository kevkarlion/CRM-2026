// ── Technician — mi panel operativo ────────────────────────

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MetricCard, KpiGrid, SectionHeader } from '@/dashboard/components';
import { fetchTechnicianDashboard } from '@/dashboard/services/client-index';
import type { TechnicianDashboardResponse, TechnicianWorkOrder } from '@/dashboard/types/metrics';

type TaskItem = TechnicianWorkOrder;

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-warning-100 text-warning-700',
  urgent: 'bg-orange-100 text-orange-700',
  emergency: 'bg-danger-100 text-danger-700',
};

export default function TechnicianPage() {
  const [dashboard, setDashboard] = useState<TechnicianDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const dash = await fetchTechnicianDashboard();
        setDashboard(dash);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar datos');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const myLoad = dashboard?.technicianLoad[0];
  const maxLoad = 8; // Max daily work orders

  // All assigned items (work orders + technical visits)
  const allAssignedItems = dashboard?.workOrders ?? [];

  const techName = myLoad?.name?.split(' ')[0] || 'Técnico';

  // Separate items by status
  const urgentItems = allAssignedItems.filter(item => 
    item.priority === 'urgent' || item.priority === 'emergency'
  );
  
  const inProgressItems = allAssignedItems.filter(item => 
    ['assigned', 'en_route', 'on_site', 'paused'].includes(item.status)
  );
  
  const scheduledItems = allAssignedItems.filter(item => 
    ['scheduled', 'confirmed'].includes(item.status)
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mi Panel</h1>
          <p className="text-sm text-gray-500 mt-1">Hola, {techName} — este es tu resumen del día</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/work-orders/calendar"
            className="px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            📅 Ver Calendario
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 text-danger-700 rounded-lg p-4 text-sm">{error}</div>
      )}

      {/* ─── Resumen del Día ─── */}
      <section>
        <SectionHeader title="Resumen del Día" subtitle="Tu carga de trabajo actual" />
        <KpiGrid>
          <MetricCard label="Tareas Asignadas" value={dashboard?.assignedCount ?? '-'} loading={loading} />
          <MetricCard label="Completadas Hoy" value={dashboard?.completedToday ?? '-'} loading={loading}
            trend={dashboard && dashboard.completedToday > 0 ? { direction: 'up', label: 'Hoy' } : undefined} />
          <MetricCard label="Próximos 7 días" value={dashboard?.upcomingSevenDays ?? '-'} loading={loading} />
        </KpiGrid>
      </section>

      {/* ─── Mi Carga de Trabajo ─── */}
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
                  style={{ width: `${Math.min(100, (myLoad.assignedCount / maxLoad) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {myLoad.assignedCount > 5 ? '⚠️ Carga alta — priorizar tareas críticas' :
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

      {/* ─── Mis Tareas Asignadas ─── */}
      <section>
        <SectionHeader 
          title="Mis Tareas" 
          subtitle={`${allAssignedItems.length} tareas asignadas`} 
        />
        
        {/* Alerts / Priority Items */}
        {urgentItems.length > 0 && (
          <div className="mb-4 space-y-2">
            {urgentItems.map(item => (
              <AlertCard key={item._id} item={item} />
            ))}
          </div>
        )}

        {/* In Progress Items */}
        {inProgressItems.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              En Progreso ({inProgressItems.length})
            </h3>
            <div className="space-y-2">
              {inProgressItems.slice(0, 10).map(item => (
                <TaskCard key={item._id} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Scheduled Items */}
        {scheduledItems.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
              Programadas ({scheduledItems.length})
            </h3>
            <div className="space-y-2">
              {scheduledItems.slice(0, 10).map(item => (
                <TaskCard key={item._id} item={item} />
              ))}
            </div>
          </div>
        )}

        {allAssignedItems.length === 0 && !loading && (
          <div className="bg-gray-50 rounded-xl p-8 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-600 font-medium">No tienes tareas asignadas</p>
            <p className="text-sm text-gray-500 mt-1">Podés buscar órdenes disponibles en el Calendario</p>
            <Link
              href="/work-orders/calendar"
              className="inline-block mt-4 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
            >
              Ver calendario
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

// TaskCard - Muestra una tarea individual en la lista
function TaskCard({ item }: { item: TaskItem }) {
  const isWorkOrder = 'workOrderNumber' in item;
  const number = isWorkOrder ? (item as any).workOrderNumber : (item as any).visitNumber;
  const link = isWorkOrder ? `/work-orders/${item._id}` : `/technical-visits/${item._id}`;
  const typeLabel = isWorkOrder ? 'OT' : 'VT';
  const typeColor = isWorkOrder ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700';

  // Get time info
  const getTimeInfo = () => {
    if (item.scheduledStart) {
      const time = typeof item.scheduledStart === 'string' 
        ? new Date(item.scheduledStart).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
        : '—';
      return `🕐 ${time}`;
    }
    if (item.scheduledDate) {
      return `📅 ${item.scheduledDate}`;
    }
    return '';
  };

  return (
    <Link
      href={link}
      className="block bg-white border border-gray-200 rounded-lg p-3 hover:border-brand-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-3">
        {/* Type badge */}
        <span className={`px-2 py-1 rounded text-xs font-bold ${typeColor}`}>
          {typeLabel}
        </span>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-500">#{number}</span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[item.priority]}`}>
              {item.priority}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-500">{getTimeInfo()}</span>
            {item.clientSnapshot?.name && (
              <span className="text-xs text-gray-400 truncate">
                📍 {item.clientSnapshot.name}
              </span>
            )}
          </div>
        </div>

        {/* Status indicator */}
        <div className={`w-2 h-2 rounded-full ${
          ['en_route', 'on_site'].includes(item.status) ? 'bg-blue-500 animate-pulse' :
          item.status === 'paused' ? 'bg-yellow-500' :
          item.status === 'assigned' ? 'bg-brand-500' :
          'bg-gray-300'
        }`} />
      </div>
    </Link>
  );
}

// AlertCard - Muestra alertas de prioridad alta/urgente
function AlertCard({ item }: { item: TaskItem }) {
  const isWorkOrder = 'workOrderNumber' in item;
  const number = isWorkOrder ? (item as any).workOrderNumber : (item as any).visitNumber;
  const link = isWorkOrder ? `/work-orders/${item._id}` : `/technical-visits/${item._id}`;
  const isEmergency = item.priority === 'emergency';
  
  const alertColor = isEmergency 
    ? 'bg-danger-50 border-danger-200 text-danger-800' 
    : 'bg-warning-50 border-warning-200 text-warning-800';
  
  const alertIcon = isEmergency ? '🚨' : '⚠️';

  return (
    <Link
      href={link}
      className={`block ${alertColor} border rounded-xl p-4 hover:shadow-md transition-all`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{alertIcon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase">
              {isEmergency ? 'EMERGENCIA' : 'URGENTE'}
            </span>
            <span className="text-xs font-mono opacity-75">#{number}</span>
          </div>
          <h3 className="font-semibold">{item.title}</h3>
          {item.clientSnapshot?.name && (
            <p className="text-sm opacity-75 mt-1">
              📍 {item.clientSnapshot.name}
            </p>
          )}
          {item.scheduledDate && (
            <p className="text-xs opacity-75 mt-1">
              📅 {item.scheduledDate}
              {item.scheduledStart && ` a las ${item.scheduledStart}`}
            </p>
          )}
        </div>
        <svg className="w-5 h-5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}