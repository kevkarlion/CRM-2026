'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateShort as formatDate, daysRemaining } from '@/operations/helpers/date-utils';
import { TECHNICAL_VISIT_STATUS_VARIANT, TECHNICAL_VISIT_PRIORITY_VARIANT } from '@/operations/constants/status-colors';
import type { TechnicalVisitRow } from '@/operations/types/centro-operativo';

function shortNumber(number: string): string {
  if (!number) return '';
  return number.slice(-7);
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

type VisitFilter = 'all' | 'withoutTechnician' | 'overdue' | 'today' | 'urgent' | 'completed';

interface FilterPill {
  key: VisitFilter;
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

function matchVisitFilter(visit: TechnicalVisitRow, filter: VisitFilter): boolean {
  if (filter === 'all') return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const visitDate = visit.scheduledDate ? new Date(visit.scheduledDate) : null;
  const isDone = visit.status === 'completed' || visit.status === 'cancelled';

  switch (filter) {
    case 'withoutTechnician':
      return !visit.technicianName;
    case 'overdue':
      return !isDone && !!visitDate && visitDate < today;
    case 'today':
      return !!visitDate && visitDate.getTime() === today.getTime();
    case 'urgent':
      return visit.priority === 'urgent';
    case 'completed':
      // TODO: enlazar lógica de completadas
      return false;
    default:
      return true;
  }
}

interface TechnicalVisitsViewProps {
  visits: TechnicalVisitRow[];
  onRefresh: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  scheduled: 'Programado',
  confirmed: 'Confirmado',
  in_progress: 'En Curso',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

export function TechnicalVisitsView({ visits, onRefresh }: TechnicalVisitsViewProps) {
  const router = useRouter();
  const [visitFilter, setVisitFilter] = useState<VisitFilter>('all');
  const [sortPriority, setSortPriority] = useState(true);
  const [sortDate, setSortDate] = useState<'asc' | 'desc' | null>(null);

  // Compute counts for pills from raw visits (unfiltered)
  const counts = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return {
      all: visits.length,
      withoutTechnician: visits.filter(v => !v.technicianName).length,
      overdue: visits.filter(v => {
        const d = v.scheduledDate ? new Date(v.scheduledDate) : null;
        return !!d && d < now && v.status !== 'completed' && v.status !== 'cancelled';
      }).length,
      today: visits.filter(v => {
        const d = v.scheduledDate ? new Date(v.scheduledDate) : null;
        return !!d && d.getTime() === now.getTime();
      }).length,
      urgent: visits.filter(v => v.priority === 'urgent').length,
      completed: 0, // TODO: enlazar lógica
    };
  }, [visits]);

  // Filter by pill, then sort
  const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

  const sorted = useMemo(() => {
    const filtered = visits.filter((v) => matchVisitFilter(v, visitFilter));
    return [...filtered].sort((a, b) => {
      if (sortPriority) {
        const pA = PRIORITY_ORDER[a.priority] ?? 4;
        const pB = PRIORITY_ORDER[b.priority] ?? 4;
        if (pA !== pB) return pA - pB;
      }

      if (sortDate) {
        const dateA = a.scheduledStart || a.scheduledDate || '';
        const dateB = b.scheduledStart || b.scheduledDate || '';
        const cmp = dateA.localeCompare(dateB);
        if (cmp !== 0) return sortDate === 'asc' ? cmp : -cmp;
      }

      return 0;
    });
  }, [visits, visitFilter, sortPriority, sortDate]);

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_PILLS.map((pill) => (
          <button
            key={pill.key}
            onClick={() => setVisitFilter(pill.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
              visitFilter === pill.key ? pill.activeColor : pill.color
            }`}
          >
            <span>{pill.label}</span>
            <span className={`tabular-nums font-bold text-[10px] ${visitFilter === pill.key ? '' : 'text-gray-400'}`}>
              {counts[pill.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">
          {sorted.length} {sorted.length === 1 ? 'visita' : 'visitas'}
          {visitFilter !== 'all' && ' filtradas'}
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

      {/* Desktop Table */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
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
          <tbody>
            {sorted.map((visit) => (
              <tr
                key={visit._id}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700">VT</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-sm font-medium text-gray-900">#{shortNumber(visit.visitNumber)}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-sm text-gray-900 max-w-[200px] truncate block">{visit.title}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-sm text-gray-600">{visit.clientSnapshot?.name || '—'}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TECHNICAL_VISIT_STATUS_VARIANT[visit.status] || 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABELS[visit.status] || visit.status}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TECHNICAL_VISIT_PRIORITY_VARIANT[visit.priority] || 'bg-gray-100 text-gray-700'}`}>
                    {PRIORITY_LABELS[visit.priority] || visit.priority}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="text-sm text-gray-600 whitespace-nowrap">
                    {visit.scheduledDate ? (
                      <div>
                        <p>{formatDate(visit.scheduledDate)}</p>
                        {visit.scheduledStart && (
                          <p className="text-xs text-gray-400">{formatTime(visit.scheduledStart)}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-sm text-gray-600">{visit.technicianName || 'Sin asignar'}</span>
                </td>
                <td className="px-4 py-2.5">
                  {(() => {
                    const badge = daysRemaining(visit.scheduledStart, visit.scheduledDate);
                    if (!badge) return <span className="text-xs text-gray-400">—</span>;
                    return (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.variant}`}>
                        {badge.label}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/technical-visits/${visit._id}`);
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

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {sorted.map((visit) => (
          <div
            key={visit._id}
            className="bg-white border border-gray-200 rounded-xl p-4 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700">VT</span>
                <span className="text-xs text-gray-400">#{shortNumber(visit.visitNumber)}</span>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TECHNICAL_VISIT_STATUS_VARIANT[visit.status] || 'bg-gray-100 text-gray-700'}`}>
                {STATUS_LABELS[visit.status] || visit.status}
              </span>
            </div>
            <p className="font-medium text-gray-900 text-sm mb-2">{visit.title}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
              <span className="text-gray-700">{visit.clientSnapshot?.name || '—'}</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TECHNICAL_VISIT_PRIORITY_VARIANT[visit.priority] || 'bg-gray-100 text-gray-700'}`}>
                {PRIORITY_LABELS[visit.priority] || visit.priority}
              </span>
              <span>{formatDate(visit.scheduledDate)}</span>
              {visit.technicianName && <span>Técnico: {visit.technicianName}</span>}
              {(() => {
                const badge = daysRemaining(visit.scheduledStart, visit.scheduledDate);
                if (!badge) return null;
                return (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.variant}`}>
                    {badge.label}
                  </span>
                );
              })()}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/technical-visits/${visit._id}`);
                }}
                className="text-xs font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                Ver
              </button>
            </div>
          </div>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          No hay visitas técnicas que coincidan con los filtros
        </div>
      )}
    </div>
  );
}
