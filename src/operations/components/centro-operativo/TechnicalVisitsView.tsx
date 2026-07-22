'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateShort as formatDate } from '@/operations/helpers/date-utils';
import type { TechnicalVisitRow } from '@/operations/types/centro-operativo';

interface TechnicalVisitsViewProps {
  visits: TechnicalVisitRow[];
  onRefresh: () => void;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'scheduled', label: 'Programado' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'in_progress', label: 'En Curso' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'low', label: 'Baja' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'budget', label: 'Presupuesto' },
  { value: 'inspection', label: 'Inspección' },
  { value: 'assessment', label: 'Evaluación' },
  { value: 'emergency', label: 'Emergencia' },
  { value: 'other', label: 'Otra' },
];

const STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-teal-50 text-teal-700',
  in_progress: 'bg-amber-50 text-amber-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
  converted_to_work_order: 'bg-purple-50 text-purple-700',
};

const PRIORITY_VARIANT: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-50 text-orange-700',
  urgent: 'bg-red-50 text-red-700',
};

const CATEGORY_VARIANT: Record<string, string> = {
  budget: 'bg-blue-100 text-blue-700',
  inspection: 'bg-purple-100 text-purple-700',
  assessment: 'bg-teal-100 text-teal-700',
  emergency: 'bg-red-100 text-red-700',
  other: 'bg-gray-100 text-gray-700',
};

function label(opts: { value: string; label: string }[], val: string) {
  return opts.find((o) => o.value === val)?.label || val;
}

export function TechnicalVisitsView({ visits, onRefresh }: TechnicalVisitsViewProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const filtered = visits.filter((v) => {
    if (statusFilter && v.status !== statusFilter) return false;
    if (categoryFilter && v.category !== categoryFilter) return false;
    if (priorityFilter && v.priority !== priorityFilter) return false;
    return true;
  });

  // Sort by priority then date
  const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  const sorted = [...filtered].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 4;
    const pb = PRIORITY_ORDER[b.priority] ?? 4;
    if (pa !== pb) return pa - pb;
    return (b.scheduledDate || '').localeCompare(a.scheduledDate || '');
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white"
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600">#</th>
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Título</th>
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Cliente</th>
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Categoría</th>
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Estado</th>
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Prioridad</th>
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Programado</th>
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Técnico</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((visit) => (
              <tr
                key={visit._id}
                onClick={() => router.push(`/technical-visits/${visit._id}`)}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-2.5 font-medium text-gray-900">{visit.visitNumber}</td>
                <td className="px-4 py-2.5 font-medium text-gray-900">{visit.title}</td>
                <td className="px-4 py-2.5 text-gray-700">{visit.clientSnapshot?.name || '—'}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_VARIANT[visit.category] || 'bg-gray-100 text-gray-700'}`}>
                    {label(CATEGORY_OPTIONS, visit.category)}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[visit.status] || 'bg-gray-100 text-gray-700'}`}>
                    {label(STATUS_OPTIONS, visit.status)}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_VARIANT[visit.priority] || 'bg-gray-100 text-gray-700'}`}>
                    {label(PRIORITY_OPTIONS, visit.priority)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-500">{formatDate(visit.scheduledDate)}</td>
                <td className="px-4 py-2.5 text-gray-700">{visit.technicianName || '—'}</td>
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
            onClick={() => router.push(`/technical-visits/${visit._id}`)}
            className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-gray-900">{visit.title}</p>
                <p className="text-xs text-gray-400">{visit.visitNumber}</p>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[visit.status] || 'bg-gray-100 text-gray-700'}`}>
                {label(STATUS_OPTIONS, visit.status)}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
              <span className="text-gray-700">{visit.clientSnapshot?.name || '—'}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_VARIANT[visit.priority] || 'bg-gray-100 text-gray-700'}`}>
                {label(PRIORITY_OPTIONS, visit.priority)}
              </span>
              <span>{formatDate(visit.scheduledDate)}</span>
              {visit.technicianName && <span>Técnico: {visit.technicianName}</span>}
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
