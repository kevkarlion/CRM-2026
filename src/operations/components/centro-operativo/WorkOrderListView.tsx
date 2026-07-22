'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { SelfAssignmentDrawer } from '@/operations/components/SelfAssignmentDrawer';
import { WORK_ORDER_STATUS_VARIANT, WORK_ORDER_PRIORITY_VARIANT } from '@/operations/constants/status-colors';
import { formatDateMonthShort as formatDate } from '@/operations/helpers/date-utils';
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

function WorkOrderCard({ wo, onAutoAssign }: { wo: WorkOrderRow; onAutoAssign: () => void }) {
  const router = useRouter();
  const canAutoAssign = !wo.assignedTechnicians?.length && ['draft', 'scheduled', 'confirmed'].includes(wo.status);

  return (
    <div
      onClick={() => router.push(`/work-orders/${wo._id}`)}
      className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer active:bg-gray-50"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{wo.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">#{wo.workOrderNumber}</p>
        </div>
        <Badge variant={WORK_ORDER_PRIORITY_VARIANT[wo.priority] || 'bg-gray-100 text-gray-700'}>
          {PRIORITY_LABELS[wo.priority] || wo.priority}
        </Badge>
      </div>

      <p className="text-xs text-gray-500 mb-2 truncate">
        {wo.clientSnapshot?.name || 'Sin cliente'}
      </p>

      <div className="flex items-center gap-2 mb-2">
        <Badge variant={WORK_ORDER_STATUS_VARIANT[wo.status] || 'bg-gray-100 text-gray-700'}>
          {STATUS_LABELS[wo.status] || wo.status}
        </Badge>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">
          {wo.scheduledDate ? (
            <span>{formatDate(wo.scheduledDate)} {formatTime(wo.scheduledStart)}</span>
          ) : (
            <span>Sin programar</span>
          )}
        </div>

        {wo.assignedTechnicians?.length > 0 ? (
          <div className="flex -space-x-1.5">
            {wo.assignedTechnicians.slice(0, 2).map((name, i) => (
              <span
                key={i}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-medium text-blue-700 ring-2 ring-white"
                title={name}
              >
                {getInitials(name)}
              </span>
            ))}
          </div>
        ) : canAutoAssign ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAutoAssign();
            }}
            className="text-xs font-medium text-brand-600 hover:text-brand-700 px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors"
          >
            Auto-asignar
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function WorkOrderListView({ workOrders, onRefresh }: WorkOrderListViewProps) {
  const router = useRouter();
  const [sortField, setSortField] = useState<'priority' | 'date'>('priority');
  const [selfAssignWO, setSelfAssignWO] = useState<WorkOrderRow | null>(null);

  const sortedWorkOrders = useMemo(() => {
    return [...workOrders].sort((a, b) => {
      if (sortField === 'priority') {
        const pA = PRIORITY_ORDER[a.priority] ?? 5;
        const pB = PRIORITY_ORDER[b.priority] ?? 5;
        if (pA !== pB) return pA - pB;
      }
      const dateA = a.scheduledStart || a.scheduledDate || '';
      const dateB = b.scheduledStart || b.scheduledDate || '';
      if (dateA && dateB) return dateA.localeCompare(dateB);
      if (dateA) return -1;
      if (dateB) return 1;
      return 0;
    });
  }, [workOrders, sortField]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          Órdenes de Trabajo ({workOrders.length})
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
              onClick={() => setSortField('priority')}
              className={`px-3 py-1 text-xs font-medium rounded-l-lg transition-colors ${
                sortField === 'priority'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Prioridad
            </button>
            <button
              onClick={() => setSortField('date')}
              className={`px-3 py-1 text-xs font-medium rounded-r-lg border-l border-gray-200 transition-colors ${
                sortField === 'date'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Fecha
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
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4"># OT</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">Cliente</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">Título</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">Prioridad</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">Estado</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">Fecha</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">Técnico</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide py-3 px-4">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedWorkOrders.map((wo) => {
                const canAutoAssign =
                  !wo.assignedTechnicians?.length &&
                  ['draft', 'scheduled', 'confirmed'].includes(wo.status);

                return (
                  <tr
                    key={wo._id}
                    onClick={() => router.push(`/work-orders/${wo._id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium text-gray-900">#{wo.workOrderNumber}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">{wo.clientSnapshot?.name || '—'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-900 max-w-[200px] truncate block">{wo.title}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={WORK_ORDER_PRIORITY_VARIANT[wo.priority] || 'bg-gray-100 text-gray-700'}>
                        {PRIORITY_LABELS[wo.priority] || wo.priority}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={WORK_ORDER_STATUS_VARIANT[wo.status] || 'bg-gray-100 text-gray-700'}>
                        {STATUS_LABELS[wo.status] || wo.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">
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
                      {canAutoAssign ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelfAssignWO(wo);
                          }}
                          className="text-xs font-medium text-brand-600 hover:text-brand-700 px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors"
                        >
                          Auto-asignar
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sortedWorkOrders.length === 0 && (
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
        {sortedWorkOrders.map((wo) => (
          <WorkOrderCard key={wo._id} wo={wo} onAutoAssign={() => setSelfAssignWO(wo)} />
        ))}

        {sortedWorkOrders.length === 0 && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-sm font-medium text-gray-900">No hay órdenes de trabajo</p>
            <p className="text-xs text-gray-500 mt-1">No se encontraron OTs con los filtros actuales</p>
          </div>
        )}
      </div>

      {selfAssignWO && (
        <SelfAssignmentDrawer
          isOpen={true}
          onClose={() => setSelfAssignWO(null)}
          workOrderId={selfAssignWO._id}
          workOrderNumber={selfAssignWO.workOrderNumber}
          onAssigned={() => {
            setSelfAssignWO(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
