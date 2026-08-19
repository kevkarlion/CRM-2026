'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, ArrowUp10, ArrowDown10, FileText } from 'lucide-react';
import { WORK_ORDER_STATUS_VARIANT, WORK_ORDER_PRIORITY_VARIANT } from '@/operations/constants/status-colors';
import { formatDateShort as formatDate, daysRemaining } from '@/operations/helpers/date-utils';
import type { WorkOrderRow } from '@/operations/types/centro-operativo';

interface WorkOrderListViewProps {
  workOrders: WorkOrderRow[];
  onRefresh: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  // Estados canónicos
  pending_assignment: 'Pendiente',
  assigned: 'Asignada',
  scheduled: 'Programada',
  in_progress: 'En Ejecución',
  closed: 'Cerrada',
  cancelled: 'Cancelada',
  // Estados viejos (compatibilidad con datos existentes)
  completed: 'Cerrada',
  draft: 'Borrador',
  confirmed: 'Confirmada',
  paused: 'Pausada',
};

const PRIORITY_LABELS: Record<string, string> = {
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
};

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function Badge({ variant, children }: { variant: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${variant}`}>
      {children}
    </span>
  );
}

function shortWO(number: string): string {
  if (!number) return '';
  return number.slice(-7);
}

function sourceBadge(source: string): { label: string; variant: string } {
  switch (source) {
    case 'technical_visit':
      return { label: 'VT', variant: 'bg-purple-100 text-purple-700' };
    case 'manual':
    case 'lead_conversion':
    case 'maintenance_contract':
    case 'direct_sale':
      return { label: 'OT', variant: 'bg-blue-100 text-blue-700' };
    default:
      return { label: '—', variant: 'bg-gray-100 text-gray-700' };
  }
}

type OrderFilter = 'all' | 'withoutTechnician' | 'overdue' | 'today' | 'urgent' | 'closed';

interface FilterPill {
  key: OrderFilter;
  label: string;
  color: string;
  activeColor: string;
}

const FILTER_PILLS: FilterPill[] = [
  { key: 'all', label: 'Todas', color: 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 border-gray-200 dark:border-slate-600', activeColor: 'bg-gray-900 dark:bg-slate-100 text-white dark:text-slate-900 border-gray-900 dark:border-slate-100' },
  { key: 'withoutTechnician', label: 'Sin asignar', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 border-amber-200 dark:border-amber-800', activeColor: 'bg-amber-600 text-white border-amber-600' },
  { key: 'overdue', label: 'Vencidas', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 border-red-200 dark:border-red-800', activeColor: 'bg-red-600 text-white border-red-600' },
  { key: 'today', label: 'Hoy', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800', activeColor: 'bg-blue-600 text-white border-blue-600' },
  { key: 'urgent', label: 'Urgentes', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 border-red-200 dark:border-red-800', activeColor: 'bg-red-600 text-white border-red-600' },
  { key: 'closed', label: 'Cerradas', color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 border-green-200 dark:border-green-800', activeColor: 'bg-green-600 text-white border-green-600' },
];

function filterWorkOrders(orders: WorkOrderRow[], filter: OrderFilter): WorkOrderRow[] {
  const today = new Date();
  // Reset to midnight local time for accurate date comparison
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayStr = todayStart.toISOString().split('T')[0];

  // Helper to normalize scheduledDate to YYYY-MM-DD string
  const getScheduledDateStr = (date: any): string | null => {
    if (!date) return null;
    if (typeof date === 'string') {
      // Handle both "2026-08-18" and "2026-08-18T00:00:00.000Z" formats
      return date.split('T')[0];
    }
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    return null;
  };

  switch (filter) {
    case 'all':
      return orders;
    case 'withoutTechnician':
      return orders.filter((wo) => !wo.assignedTechnicians?.length);
    case 'overdue':
      return orders.filter((wo) => {
        const scheduledDateStr = getScheduledDateStr(wo.scheduledDate);
        if (!scheduledDateStr) return false;
        // Excluir estados terminales canónicos y legacy
        return scheduledDateStr < todayStr && !['closed', 'cancelled', 'completed'].includes(wo.status);
      });
    case 'today':
      return orders.filter((wo) => {
        const scheduledDateStr = getScheduledDateStr(wo.scheduledDate);
        if (!scheduledDateStr) return false;
        return scheduledDateStr === todayStr;
      });
    case 'urgent':
      return orders.filter((wo) => wo.priority === 'urgent');
    case 'closed':
      return orders.filter((wo) => wo.status === 'closed' || wo.status === 'completed');
  }
}

function WorkOrderCard({ wo }: { wo: WorkOrderRow }) {
  const router = useRouter();

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-slate-900/50 transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{wo.title}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">#{shortWO(wo.workOrderNumber)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${sourceBadge(wo.source).variant}`}>
            {sourceBadge(wo.source).label}
          </span>
          <Badge variant={WORK_ORDER_PRIORITY_VARIANT[wo.priority] || 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'}>
            {PRIORITY_LABELS[wo.priority] || wo.priority}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <Badge variant={WORK_ORDER_STATUS_VARIANT[wo.status] || 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'}>
          {STATUS_LABELS[wo.status] || wo.status}
        </Badge>
        {(() => {
          const badge = daysRemaining(wo.scheduledStart, wo.scheduledDate);
          if (!badge) return null;
          return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.variant}`}>
              {badge.label}
            </span>
          );
        })()}
      </div>

      <p className="text-xs text-gray-500 dark:text-slate-400 mb-2 truncate">
        {wo.clientSnapshot?.name || 'Sin cliente'}
      </p>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400 dark:text-slate-500">
          {wo.scheduledDate ? (
            <span>{formatDate(wo.scheduledDate)} {formatTime(wo.scheduledStart)}</span>
          ) : (
            <span>Sin programar</span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/work-orders/${wo._id}`);
          }}
          className="inline-flex items-center rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-100 cursor-pointer"
        >
          Ver
        </button>
      </div>
    </div>
  );
}

export function WorkOrderListView({ workOrders, onRefresh }: WorkOrderListViewProps) {
  const router = useRouter();
  const [sortPriority, setSortPriority] = useState(false);
  const [sortDate, setSortDate] = useState<'asc' | 'desc'>('desc');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');

  // Compute counts per filter from the raw workOrders data
  const counts = useMemo(() => {
    const entries: [OrderFilter, () => number][] = [
      ['all', () => workOrders.length],
      ['withoutTechnician', () => workOrders.filter((wo) => !wo.assignedTechnicians?.length).length],
      ['overdue', () => filterWorkOrders(workOrders, 'overdue').length],
      ['today', () => filterWorkOrders(workOrders, 'today').length],
      ['urgent', () => filterWorkOrders(workOrders, 'urgent').length],
      ['closed', () => filterWorkOrders(workOrders, 'closed').length],
    ];
    return Object.fromEntries(entries.map(([k, fn]) => [k, fn()])) as Record<OrderFilter, number>;
  }, [workOrders]);

  // Filter then sort
  const filteredWorkOrders = useMemo(() => {
    const filtered = filterWorkOrders(workOrders, orderFilter);
    return [...filtered].sort((a, b) => {
      // Sort by priority if active
      if (sortPriority) {
        const pA = PRIORITY_ORDER[a.priority] ?? 5;
        const pB = PRIORITY_ORDER[b.priority] ?? 5;
        if (pA !== pB) return pA - pB;
      }

      // Secondary sort by date if active
      if (sortDate) {
        const dateA = a.scheduledStart || a.scheduledDate || '';
        const dateB = b.scheduledStart || b.scheduledDate || '';
        const cmp = dateA.localeCompare(dateB);
        if (cmp !== 0) return sortDate === 'asc' ? cmp : -cmp;
      }

      return 0;
    });
  }, [workOrders, orderFilter, sortPriority, sortDate]);

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_PILLS.map((pill) => (
          <button
            key={pill.key}
            onClick={() => setOrderFilter(pill.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap cursor-pointer ${
              orderFilter === pill.key ? pill.activeColor : pill.color
            }`}
          >
            <span>{pill.label}</span>
            <span className={`tabular-nums font-bold text-[10px] ${orderFilter === pill.key ? '' : 'text-gray-400'}`}>
              {counts[pill.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
          Órdenes de Trabajo ({filteredWorkOrders.length})
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            title="Actualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <span className="text-xs font-medium text-gray-500 dark:text-slate-400">Filtrar por:</span>
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800">
            <button
              onClick={() => setSortPriority((p) => !p)}
              className={`px-3 py-1 text-xs font-medium rounded-l-lg transition-colors cursor-pointer ${
                sortPriority
                  ? 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-slate-100'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
              title={sortPriority ? 'Ordenando por prioridad' : 'Activar orden por prioridad'}
            >
              Prioridad
            </button>
            <button
              onClick={() => setSortDate((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className={`px-3 py-1 text-xs font-medium rounded-r-lg border-l border-gray-200 dark:border-slate-600 transition-colors flex items-center gap-1 cursor-pointer ${
                'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-slate-100'
              }`}
              title={sortDate === 'asc' ? 'Más vieja → más nueva' : 'Más nueva → más vieja'}
            >
              Fecha
              {sortDate === 'asc' ? <ArrowUp10 className="w-3 h-3" /> : <ArrowDown10 className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop table */}
<div className="hidden md:block bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-800/80">
                <th className="w-14 px-2 py-2 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Acción</th>
                <th className="w-14 px-2 py-2 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Tipo</th>
                <th className="w-14 px-2 py-2 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">#</th>
                <th className="min-w-[120px] px-2 py-2 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Título</th>
                <th className="min-w-[100px] px-2 py-2 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Cliente</th>
                <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Estado</th>
                <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Prioridad</th>
                <th className="w-24 px-2 py-2 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Programado</th>
                <th className="w-24 px-2 py-2 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Técnico</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Días</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {filteredWorkOrders.map((wo, idx) => (
                <tr
                  key={wo._id}
                  className={`border-b border-gray-100 dark:border-slate-700/50 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50/50 dark:bg-slate-800/50'} hover:bg-brand-50/40 dark:hover:bg-brand-900/20 transition-colors`}
                >
                  <td className="px-2 py-1.5 align-middle">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/work-orders/${wo._id}`);
                      }}
                      className="inline-flex items-center gap-1 rounded-md bg-brand-50 dark:bg-brand-900/30 px-2 py-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/50 cursor-pointer"
                    >
                      Ver
                    </button>
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${sourceBadge(wo.source).variant}`}>
                      {sourceBadge(wo.source).label}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <span className="text-xs font-medium text-gray-900 dark:text-slate-100">#{shortWO(wo.workOrderNumber)}</span>
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <span className="text-xs text-gray-900 dark:text-slate-100">{wo.title}</span>
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <span className="text-xs text-gray-600 dark:text-slate-300">{wo.clientSnapshot?.name || '—'}</span>
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <Badge variant={WORK_ORDER_STATUS_VARIANT[wo.status] || 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'}>
                      {STATUS_LABELS[wo.status] || wo.status}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <Badge variant={WORK_ORDER_PRIORITY_VARIANT[wo.priority] || 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'}>
                      {PRIORITY_LABELS[wo.priority] || wo.priority}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <div className="text-xs text-gray-600 dark:text-slate-300 whitespace-nowrap">
                      {wo.scheduledDate ? (
                        <div>
                          <p>{formatDate(wo.scheduledDate)}</p>
                          {wo.scheduledStart && (
                            <p className="text-[10px] text-gray-400 dark:text-slate-500">{formatTime(wo.scheduledStart)}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-slate-500">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    {wo.assignedTechnicians?.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                          {getInitials(wo.assignedTechnicians[0])}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-slate-300">{wo.assignedTechnicians[0]}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-slate-500">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    {(() => {
                      const badge = daysRemaining(wo.scheduledStart, wo.scheduledDate);
                      if (!badge) return <span className="text-[10px] text-gray-400 dark:text-slate-500">—</span>;
                      return (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium ${badge.variant}`}>
                          {badge.label}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredWorkOrders.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">No hay órdenes de trabajo</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">No se encontraron OTs con los filtros actuales</p>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filteredWorkOrders.map((wo) => (
          <WorkOrderCard key={wo._id} wo={wo} />
        ))}

        {filteredWorkOrders.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl">
            <FileText className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">No hay órdenes de trabajo</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">No se encontraron OTs con los filtros actuales</p>
          </div>
        )}
      </div>


    </div>
  );
}
