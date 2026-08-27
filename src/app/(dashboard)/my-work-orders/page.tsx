'use client';

import { useRouter } from 'next/navigation';
import { useRole } from '@/dashboard/context/role-context';
import { useMyWorkOrders, type MyWorkOrder } from '@/leads/pipeline-board/hooks/useMyWorkOrders';
import { Loader2, RefreshCw, ArrowLeft } from 'lucide-react';
import { formatDateShort } from '@/operations/helpers/date-utils';

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  assigned: 'Asignada',
  in_progress: 'En Ejecución',
  paused: 'Pausada',
  completed: 'Completada',
  closed: 'Cerrada',
};

const STATUS_VARIANT: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-green-50 text-green-700',
  assigned: 'bg-purple-50 text-purple-700',
  in_progress: 'bg-amber-50 text-amber-700',
  paused: 'bg-yellow-50 text-yellow-700',
  completed: 'bg-green-50 text-green-700',
  closed: 'bg-slate-50 text-slate-700',
};

const PRIORITY_LABELS: Record<string, string> = {
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

const PRIORITY_VARIANT: Record<string, string> = {
  normal: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-50 text-orange-700',
  urgent: 'bg-red-50 text-red-700',
};

function shortWONumber(number: string): string {
  if (!number) return '—';
  return number.slice(-6);
}

function clientName(wo: MyWorkOrder): string {
  return wo.clientSnapshot?.name || '—';
}

function formatScheduledDate(date: string | undefined): string {
  if (!date) return 'Sin fecha';
  return formatDateShort(date);
}

function getDaysUntil(date: string | undefined): { text: string; variant: string } | null {
  if (!date) return null;
  
  // Calcular "hoy" en timezone Argentina (UTC-3)
  const now = new Date();
  const argentinaOffset = -3 * 60;
  const localNow = new Date(now.getTime() + (now.getTimezoneOffset() + argentinaOffset) * 60000);
  localNow.setHours(0, 0, 0, 0);
  
  // Parsear scheduledDate como fecha local Argentina
  const [year, month, day] = date.split('-').map(Number);
  const scheduled = new Date(year, month - 1, day);
  scheduled.setHours(0, 0, 0, 0);
  
  const diffTime = scheduled.getTime() - localNow.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { text: 'Vencida', variant: 'bg-red-100 text-red-700' };
  } else if (diffDays === 0) {
    return { text: 'Hoy', variant: 'bg-amber-100 text-amber-700' };
  } else if (diffDays === 1) {
    return { text: 'Mañana', variant: 'bg-yellow-100 text-yellow-700' };
  } else if (diffDays <= 7) {
    return { text: `${diffDays} días`, variant: 'bg-blue-50 text-blue-700' };
  } else {
    return { text: `${diffDays} días`, variant: 'bg-gray-50 text-gray-600' };
  }
}

export default function MyWorkOrdersPage() {
  const router = useRouter();
  const { isTechnician, isAdmin, loading: roleLoading } = useRole();
  const { orders, loading, error, total, refetch } = useMyWorkOrders();

  // Redirect if not a technician
  if (!roleLoading && !isTechnician && !isAdmin) {
    router.push('/');
    return null;
  }

  if (roleLoading || loading) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="h-7 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mt-2" />
          </div>
          <div className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        {/* Table skeleton */}
        <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="w-14 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase"></th>
                <th className="min-w-[120px] px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase"></th>
                <th className="min-w-[100px] px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase"></th>
                <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase"></th>
                <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase"></th>
                <th className="w-24 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase"></th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-2 py-1.5"><div className="h-4 w-12 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-2 py-1.5"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-2 py-1.5"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-2 py-1.5"><div className="h-5 w-16 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-2 py-1.5"><div className="h-5 w-14 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-2 py-1.5"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-2 py-1.5"><div className="h-4 w-12 bg-gray-200 rounded animate-pulse" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards skeleton */}
        <div className="sm:hidden space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
                <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
              </div>
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="flex gap-2">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Mis Órdenes de Trabajo
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {total} órdenes de trabajo activas
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Empty state */}
      {orders.length === 0 && !loading && (
        <div className="text-center py-16">
          <svg className="mx-auto w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-sm font-medium text-gray-900 mb-1">Sin órdenes de trabajo</h3>
          <p className="text-sm text-gray-500">No tenés órdenes pendientes</p>
        </div>
      )}

      {/* Desktop table */}
      {orders.length > 0 && (
        <>
          <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="w-16 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                  <th className="min-w-[100px] px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="min-w-[150px] px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Descripción</th>
                  <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Prioridad</th>
                  <th className="w-28 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Programado</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((wo, idx) => {
                  const daysIndicator = getDaysUntil(wo.scheduledDate);
                  const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
                  return (
                    <tr
                      key={wo._id}
                      className={`${rowBg} border-b border-gray-100 hover:bg-brand-50/40 transition-colors`}
                    >
                      <td className="px-2 py-1.5 font-medium text-gray-900 align-middle">#{shortWONumber(wo.workOrderNumber)}</td>
                      <td className="px-2 py-1.5 font-medium text-gray-900 align-middle">{clientName(wo)}</td>
                      <td className="px-2 py-1.5 text-gray-700 align-middle truncate max-w-[150px]">{wo.title}</td>
                      <td className="px-2 py-1.5 align-middle">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium ${STATUS_VARIANT[wo.status] || 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABELS[wo.status] || wo.status}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium ${PRIORITY_VARIANT[wo.priority] || PRIORITY_VARIANT.normal}`}>
                          {PRIORITY_LABELS[wo.priority] || wo.priority}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-gray-600">{formatScheduledDate(wo.scheduledDate)}</span>
                          {daysIndicator && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${daysIndicator.variant}`}>
                              {daysIndicator.text}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <button
                          onClick={() => router.push(`/work-orders/${wo._id}`)}
                          className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-100"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {orders.map((wo, idx) => {
              const daysIndicator = getDaysUntil(wo.scheduledDate);
              return (
                <div
                  key={wo._id}
                  className="bg-white border border-gray-200 rounded-xl p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">#{shortWONumber(wo.workOrderNumber)}</span>
                      <span className="text-yellow-500 text-sm" title="Asignada a ti">★</span>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[wo.status] || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[wo.status] || wo.status}
                    </span>
                  </div>
                  <p className="font-medium text-gray-900 mb-2">{wo.title}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 mb-2">
                    <span className="text-gray-700">{clientName(wo)}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_VARIANT[wo.priority] || 'bg-gray-100 text-gray-700'}`}>
                      {PRIORITY_LABELS[wo.priority] || wo.priority}
                    </span>
                    <span>Programado: {formatScheduledDate(wo.scheduledDate)}</span>
                    {daysIndicator && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${daysIndicator.variant}`}>
                        {daysIndicator.text}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => router.push(`/work-orders/${wo._id}`)}
                      className="inline-flex items-center justify-center gap-1.5 flex-1 text-center rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-100 hover:text-brand-700 transition-colors cursor-pointer w-full"
                    >
                      Ver
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}