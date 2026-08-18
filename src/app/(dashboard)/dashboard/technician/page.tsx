// ── Technician — mi panel operativo ────────────────────────

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ClipboardList, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Calendar,
  Gauge,
  Briefcase,
  Wrench
} from 'lucide-react';
import { RoleGuard } from '@/dashboard/components/RoleGuard';
import { fetchTechnicianDashboard } from '@/dashboard/services/client-index';
import { useRole } from '@/dashboard/context/role-context';
import type { TechnicianDashboardResponse, TechnicianWorkOrder } from '@/dashboard/types/metrics';

// ── Technician Dashboard ───────────────────────────────────

export default function TechnicianPage() {
  return (
    <RoleGuard allowedRoles={['Technician']}>
      <TechnicianDashboardContent />
    </RoleGuard>
  );
}

function TechnicianDashboardContent() {
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

  const { user } = useRole();
  const [techName, setTechName] = useState('Técnico');
  
  useEffect(() => {
    const name = user.name?.split(' ')[0] || 'Técnico';
    setTechName(name);
  }, [user.name]);

  // Fecha de hoy para filtros
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Calcular los contadores para las tarjetas
  // Asignadas para hoy
  // Asignadas: scheduled, assigned (con técnico asignado)
  const assignedWO = dashboard?.assignedBreakdown?.workOrders ?? 0;
  const assignedVT = dashboard?.assignedBreakdown?.visits ?? 0;
  const totalAssigned = assignedWO + assignedVT;
  
  // Carga del técnico
  const maxLoad = dashboard?.maxDailyLoad || 8;
  const loadPercentage = Math.round((totalAssigned / maxLoad) * 100);
  
  // Cerradas (completadas hoy)
  const resolved = dashboard?.closedToday ?? 0;
  
  // Pendientes (en progreso)
  const pending = dashboard?.inProgressOrders ?? 0;
  
  // Vencidas
  const expiredWO = dashboard?.myStats?.expiredOrders ?? 0;
  const expiredVT = dashboard?.myStats?.expiredVisits ?? 0;
  const totalExpired = expiredWO + expiredVT;

  // Todas las tareas asignadas (para mostrar en lista)
  const allAssignedItems = dashboard?.workOrders ?? [];

  // Skeleton component
  if (loading) {
    return (
      <div className="space-y-6 sm:space-y-8">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-2">
            <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-10 w-36 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        {/* Gauge skeleton */}
        <section className="bg-slate-800 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 w-40 bg-slate-700 rounded animate-pulse" />
            <div className="h-4 w-24 bg-slate-700 rounded animate-pulse" />
          </div>
          <div className="h-4 bg-slate-700 rounded-full animate-pulse mb-3" />
          <div className="flex justify-between">
            <div className="h-4 w-32 bg-slate-700 rounded animate-pulse" />
            <div className="h-6 w-16 bg-slate-700 rounded animate-pulse" />
          </div>
        </section>

        {/* Cards skeleton */}
        <section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl animate-pulse" />
                  <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="h-9 w-20 bg-gray-100 rounded animate-pulse mb-2" />
                <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </section>

        {/* List skeleton */}
        <section className="space-y-3">
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
                  <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="h-6 w-20 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mi Panel</h1>
          <p className="text-sm text-gray-500 mt-1">Hola, {techName} — este es tu resumen</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/work-orders/calendar"
            className="px-4 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            Ver Calendario
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 text-danger-700 rounded-lg p-4 text-sm">{error}</div>
      )}

      {/* ─── Medidor de Carga ─── */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold">Mi Carga de Trabajo</h2>
          </div>
          <span className="text-sm text-slate-400">
            {totalAssigned} tareas asignadas
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="relative h-4 bg-slate-700 rounded-full overflow-hidden mb-3">
          <div 
            className={`absolute left-0 top-0 h-full transition-all duration-500 ${
              loadPercentage > 80 ? 'bg-gradient-to-r from-red-500 to-red-400' :
              loadPercentage > 50 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
              'bg-gradient-to-r from-emerald-500 to-emerald-400'
            }`}
            style={{ width: `${Math.min(100, loadPercentage)}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">
            {loadPercentage > 80 ? '🔴 Alta carga - priorizá tareas críticas' :
             loadPercentage > 50 ? '🟡 Carga moderada' :
             '🟢 Buena disponibilidad'}
          </span>
          <span className="font-mono text-lg font-bold">
            {totalAssigned} / {maxLoad}
          </span>
        </div>
      </section>

      {/* ─── Las 4 Tarjetas Principales ─── */}
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. ASIGNADAS */}
          <Link
            href={`/work-orders?tab=mine&status=scheduled,assigned&startDate=${todayStr}&endDate=${todayStr}`}
            className="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-400 hover:shadow-xl hover:-translate-y-1 transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-full -mr-10 -mt-10 opacity-50" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <ClipboardList className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Asignadas para Hoy</p>
                </div>
              </div>
              <div className="text-4xl font-bold text-slate-900 mb-1">{loading ? '...' : totalAssigned}</div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Briefcase className="w-3 h-3" />
                <span>{assignedWO} OT · {assignedVT} VT</span>
              </div>
            </div>
          </Link>

          {/* 2. RESUELTAS */}
          <Link
            href="/work-orders?tab=mine&status=closed"
            className="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-emerald-400 hover:shadow-xl hover:-translate-y-1 transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-full -mr-10 -mt-10 opacity-50" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cerradas</p>
                </div>
              </div>
              <div className="text-4xl font-bold text-slate-900 mb-1">{loading ? '...' : resolved}</div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>completadas hoy</span>
              </div>
            </div>
          </Link>

          {/* 3. PENDIENTES */}
          <Link
            href="/work-orders?tab=mine&status=in_progress"
            className="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-amber-400 hover:shadow-xl hover:-translate-y-1 transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-full -mr-10 -mt-10 opacity-50" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pendientes</p>
                </div>
              </div>
              <div className="text-4xl font-bold text-slate-900 mb-1">{loading ? '...' : pending}</div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Wrench className="w-3 h-3" />
                <span>en ejecución</span>
              </div>
            </div>
          </Link>

          {/* 4. VENCIDAS */}
          <Link
            href="/work-orders?tab=mine&expired=true"
            className={`group bg-white border rounded-2xl p-5 hover:shadow-xl hover:-translate-y-1 transition-all relative overflow-hidden ${
              totalExpired > 0 ? 'border-red-200' : 'border-slate-200'
            }`}
          >
            <div className={`absolute top-0 right-0 w-20 h-20 rounded-full -mr-10 -mt-10 opacity-50 ${
              totalExpired > 0 ? 'bg-red-50' : 'bg-slate-50'
            }`} />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  totalExpired > 0 ? 'bg-red-100' : 'bg-slate-100'
                }`}>
                  <AlertTriangle className={`w-6 h-6 ${totalExpired > 0 ? 'text-red-600' : 'text-slate-400'}`} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Vencidas</p>
                </div>
              </div>
              <div className={`text-4xl font-bold mb-1 ${totalExpired > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {loading ? '...' : totalExpired}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{expiredWO} OT · {expiredVT} VT</span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ─── Mis Tareas Próximas ─── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Mis Tareas</h2>
        
        {allAssignedItems.length > 0 ? (
          <div className="space-y-2">
            {allAssignedItems.slice(0, 10).map((item) => {
              const isWorkOrder = 'workOrderNumber' in item;
              const number = isWorkOrder ? (item as any).workOrderNumber : (item as any).visitNumber;
              const shortNumber = number ? number.slice(-7) : '';
              const link = isWorkOrder ? `/work-orders/${item._id}` : `/technical-visits/${item._id}`;
              const typeLabel = isWorkOrder ? 'OT' : 'VT';
              const typeColor = isWorkOrder 
                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                : 'bg-orange-50 text-orange-700 border-orange-200';
              
              const getDateText = () => {
                if (!item.scheduledDate) return '';
                // Parsear fecha en formato YYYY-MM-DD correctamente
                const dateStr = String(item.scheduledDate);
                const [year, month, day] = dateStr.split('-').map(Number);
                const date = new Date(year, month - 1, day); // Mes es 0-indexed
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                date.setHours(0, 0, 0, 0);
                const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (diff < 0) return `⚠️ Vencida`;
                if (diff === 0) return '📅 Hoy';
                if (diff === 1) return '📅 Mañana';
                return `📅 ${item.scheduledDate}`;
              };
              
              return (
                <Link
                  key={item._id}
                  href={link}
                  className="group flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3 hover:border-brand-300 hover:shadow-sm transition-all"
                >
                  <div className={`shrink-0 flex flex-col items-center justify-center w-10 h-10 rounded-lg border ${typeColor}`}>
                    <span className="text-xs font-bold leading-none">{typeLabel}</span>
                    <span className="text-[9px] font-mono opacity-80">{shortNumber}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                    <p className="text-xs text-gray-500">{getDateText()}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-brand-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-8 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-600 font-medium">No tienes tareas asignadas</p>
          </div>
        )}
      </section>
    </div>
  );
}