'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { WORK_ORDER_STATUS_VARIANT, WORK_ORDER_PRIORITY_VARIANT } from '@/operations/constants/status-colors';
import { formatDateShort as formatDate, daysRemaining } from '@/operations/helpers/date-utils';
import type { WorkOrderRow } from '@/operations/types/centro-operativo';

interface WorkOrderListViewProps {
  workOrders: WorkOrderRow[];
  onRefresh: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  scheduled: 'Programado',
  confirmed: 'Confirmado',
  assigned: 'Asignado',
  en_route: 'En Camino',
  on_site: 'En Sitio',
  paused: 'Suspendido',
  completed: 'Completado',
  cancelled: 'Cancelado',
  closed: 'Cerrado',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
  emergency: 'Emergencia',
};

const PRIORITY_ORDER: Record<string, number> = {
  emergency: 0,
  urgent: 1,
  high: 2,
  normal: 3,
  low: 4,
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

type OrderFilter = 'all' | 'withoutTechnician' | 'overdue' | 'today' | 'urgent' | 'completed';

interface FilterPill {
  key: OrderFilter;
  label: string;
  color: string;
  activeColor: string;
}

const FILTER_PILLS: FilterPill[] = [
  { key: 'all', label: 'Todas', color: 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200', activeColor: 'bg-gray-900 text-white border-gray-900' },
  { key: 'withoutTechnician', label: 'Sin asignar', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200', activeColor: 'bg-amber-600 text-white border-amber-600' },
  { key: 'overdue', label: 'Atrasadas', color: 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200', activeColor: 'bg-red-600 text-white border-red-600' },
  { key: 'today', label: 'Hoy', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200', activeColor: 'bg-blue-600 text-white border-blue-600' },
  { key: 'urgent', label: 'Urgentes', color: 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200', activeColor: 'bg-red-600 text-white border-red-600' },
  { key: 'completed', label: 'Completadas', color: 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200', activeColor: 'bg-green-600 text-white border-green-600' },
];

function filterWorkOrders(orders: WorkOrderRow[], filter: OrderFilter): WorkOrderRow[] {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  switch (filter) {
    case 'all':
      return orders;
    case 'withoutTechnician':
      return orders.filter((wo) => !wo.assignedTechnicians?.length);
    case 'overdue':
      return orders.filter((wo) => {
        if (!wo.scheduledDate) return false;
        return wo.scheduledDate < todayStr && !['completed', 'cancelled', 'closed'].includes(wo.status);
      });
    case 'today':
      return orders.filter((wo) => wo.scheduledDate === todayStr);
    case 'urgent':
      return orders.filter((wo) => wo.priority === 'urgent' || wo.priority === 'emergency');
    case 'completed':
      // TODO: enlazar lógica de completadas
      return [];
  }
}

function WorkOrderCard({ wo }: { wo: WorkOrderRow }) {
  const router = useRouter();

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{wo.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">#{shortWO(wo.workOrderNumber)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${sourceBadge(wo.source).variant}`}>
            {sourceBadge(wo.source).label}
          </span>
          <Badge variant={WORK_ORDER_PRIORITY_VARIANT[wo.priority] || 'bg-gray-100 text-gray-700'}>
            {PRIORITY_LABELS[wo.priority] || wo.priority}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <Badge variant={WORK_ORDER_STATUS_VARIANT[wo.status] || 'bg-gray-100 text-gray-700'}>
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

      <p className="text-xs text-gray-500 mb-2 truncate">
        {wo.clientSnapshot?.name || 'Sin cliente'}
      </p>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">
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
          className="text-xs font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          Ver
        </button>
      </div>
    </div>
  );
}

export function WorkOrderListView({ workOrders, onRefresh }: WorkOrderListViewProps) {
  const router = useRouter();
  const [sortPriority, setSortPriority] = useState(true);
  const [sortDate, setSortDate] = useState<'asc' | 'desc' | null>(null);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');

  // Compute counts per filter from the raw workOrders data
  const counts = useMemo(() => {
    const entries: [OrderFilter, () => number][] = [
      ['all', () => workOrders.length],
      ['withoutTechnician', () => workOrders.filter((wo) => !wo.assignedTechnicians?.length).length],
      ['overdue', () => filterWorkOrders(workOrders, 'overdue').length],
      ['today', () => filterWorkOrders(workOrders, 'today').length],
      ['urgent', () => filterWorkOrders(workOrders, 'urgent').length],
      ['completed', () => 0], // TODO: enlazar lógica
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
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
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
        <h2 className="text-sm font-semibold text-gray-900">
          Órdenes de Trabajo ({filteredWorkOrders.length})
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Actualizar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
            </svg>
          </button>
          <div className="inline-flex rounded-lg border border-gray-200 bg-white">
            <button
              onClick={() => setSortPriority((p) => !p)}
              className={`px-3 py-1 text-xs font-medium rounded-l-lg transition-colors ${
                sortPriority
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title={sortPriority ? 'Ordenando por prioridad' : 'Activar orden por prioridad'}
            >
              Prioridad
            </button>
            <button
              onClick={() => {
                setSortDate((prev) => {
                  if (prev === null) return 'asc';
                  if (prev === 'asc') return 'desc';
                  return null;
                });
              }}
              className={`px-3 py-1 text-xs font-medium rounded-r-lg border-l border-gray-200 transition-colors flex items-center gap-1 ${
                sortDate
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title={sortDate === null ? 'Ordenar por fecha' : sortDate === 'asc' ? 'Más vieja → más nueva' : 'Más nueva → más vieja'}
            >
              Fecha
              {sortDate === 'asc' && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12" />
                </svg>
              )}
              {sortDate === 'desc' && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0-3.75-3.75M17.25 21 21 17.25" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">Tipo</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">#</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">Título</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">Cliente</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">Estado</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">Prioridad</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">Programado</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">Técnico</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">Días restantes</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredWorkOrders.map((wo) => (
                <tr
                  key={wo._id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${sourceBadge(wo.source).variant}`}>
                      {sourceBadge(wo.source).label}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-medium text-gray-900">#{shortWO(wo.workOrderNumber)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-900 max-w-[200px] truncate block">{wo.title}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-600">{wo.clientSnapshot?.name || '—'}</span>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={WORK_ORDER_STATUS_VARIANT[wo.status] || 'bg-gray-100 text-gray-700'}>
                      {STATUS_LABELS[wo.status] || wo.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={WORK_ORDER_PRIORITY_VARIANT[wo.priority] || 'bg-gray-100 text-gray-700'}>
                      {PRIORITY_LABELS[wo.priority] || wo.priority}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-gray-600 whitespace-nowrap">
                      {wo.scheduledDate ? (
                        <div>
                          <p>{formatDate(wo.scheduledDate)}</p>
                          {wo.scheduledStart && (
                            <p className="text-xs text-gray-400">{formatTime(wo.scheduledStart)}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {wo.assignedTechnicians?.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-medium text-blue-700">
                          {getInitials(wo.assignedTechnicians[0])}
                        </span>
                        <span className="text-sm text-gray-600">{wo.assignedTechnicians[0]}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Sin asignar</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {(() => {
                      const badge = daysRemaining(wo.scheduledStart, wo.scheduledDate);
                      if (!badge) return <span className="text-xs text-gray-400">—</span>;
                      return (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.variant}`}>
                          {badge.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/work-orders/${wo._id}`);
                      }}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredWorkOrders.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-sm font-medium text-gray-900">No hay órdenes de trabajo</p>
            <p className="text-xs text-gray-500 mt-1">No se encontraron OTs con los filtros actuales</p>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filteredWorkOrders.map((wo) => (
          <WorkOrderCard key={wo._id} wo={wo} />
        ))}

        {filteredWorkOrders.length === 0 && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-sm font-medium text-gray-900">No hay órdenes de trabajo</p>
            <p className="text-xs text-gray-500 mt-1">No se encontraron OTs con los filtros actuales</p>
          </div>
        )}
      </div>


    </div>
  );
}
