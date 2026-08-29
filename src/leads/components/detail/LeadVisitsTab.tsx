'use client';

import Link from 'next/link';

import { EntityEmptyState } from '@/components/entity-detail';
import { formatDateShort } from '@/operations/helpers/date-utils';
import { TECHNICAL_VISIT_STATUS_LABELS } from '@/operations/constants/status-labels';
import { TECHNICAL_VISIT_STATUS_VARIANT } from '@/operations/constants/status-colors';
import type { VisitListItem } from './lead-detail.types';

// Móvil: badges sólidos (la tabla desktop conserva las variantes pastel)
const TECHNICAL_VISIT_STATUS_VARIANT_MOBILE: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-800',
  scheduled: 'bg-sky-600 text-white',
  confirmed: 'bg-teal-600 text-white',
  assigned: 'bg-sky-600 text-white',
  in_progress: 'bg-amber-500 text-gray-900',
  completed: 'bg-emerald-700 text-white',
  cancelled: 'bg-rose-600 text-white',
  converted_to_work_order: 'bg-violet-600 text-white',
};

interface LeadVisitsTabProps {
  visits: VisitListItem[];
  loading: boolean;
  canCreate: boolean;
  onNewVisit: () => void;
}

function formatVisitNumber(number: string): string {
  if (!number) return '';
  const clean = number.replace(/[^0-9]/g, '');
  if (clean.length >= 6) {
    const year = clean.slice(-6, -4);
    const seq = clean.slice(-4);
    return `#${year}-${seq}`;
  }
  return `#${number}`;
}

export function LeadVisitsTab({ visits, loading, canCreate, onNewVisit }: LeadVisitsTabProps) {
  if (loading) {
    return (
      <>
        <div className="hidden sm:block overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nº</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acción</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[1, 2, 3].map((i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><div className="h-4 w-12 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-16 bg-gray-200 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-10 bg-gray-200 rounded animate-pulse ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sm:hidden space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
                <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
              </div>
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </>
    );
  }

  if (visits.length === 0) {
    return (
      <EntityEmptyState
        icon={
          <svg
            className="h-12 w-12"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        }
        title="No hay visitas técnicas"
        description="Este lead aún no tiene visitas técnicas programadas."
        action={
          canCreate ? (
            <button
              onClick={onNewVisit}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
            >
              Programar Visita Técnica
            </button>
          ) : undefined
        }
      />
    );
  }

  // Sort by scheduledDate descending (newest first)
  const sortedVisits = [...visits].sort((a, b) => {
    const aDate = a.scheduledDate || a.scheduledStart || '';
    const bDate = b.scheduledDate || b.scheduledStart || '';
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <button
            onClick={onNewVisit}
            className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
          >
            Programar Visita Técnica
          </button>
        </div>
      )}

      <div className="hidden sm:block overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nº
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Título
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedVisits.map((visit) => (
              <tr key={visit._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {formatVisitNumber(visit.visitNumber)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {visit.title}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {formatDateShort(visit.scheduledDate || visit.scheduledStart || '')}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TECHNICAL_VISIT_STATUS_VARIANT[visit.status] || 'bg-gray-100 text-gray-700'}`}
                  >
                    {TECHNICAL_VISIT_STATUS_LABELS[visit.status as keyof typeof TECHNICAL_VISIT_STATUS_LABELS] || visit.status}
                  </span>
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-right align-middle">
                  <Link
                    href={`/technical-visits/${visit._id}`}
                    className="inline-flex items-center rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-100 cursor-pointer"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden space-y-3">
        {sortedVisits.map((visit) => (
          <div
            key={visit._id}
            className="bg-white border border-gray-200 border-l-4 border-l-teal-600 rounded-xl p-4 shadow-sm space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-gray-500">{formatVisitNumber(visit.visitNumber)}</p>
                <p className="font-medium text-gray-900 truncate">{visit.title}</p>
              </div>
              <span
                className={`inline-flex items-center shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${TECHNICAL_VISIT_STATUS_VARIANT_MOBILE[visit.status] || 'bg-gray-200 text-gray-800'}`}
              >
                {TECHNICAL_VISIT_STATUS_LABELS[visit.status as keyof typeof TECHNICAL_VISIT_STATUS_LABELS] || visit.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-lg px-3 py-2 col-span-2">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Fecha</span>
                <span className="block text-sm font-medium text-gray-900">
                  {formatDateShort(visit.scheduledDate || visit.scheduledStart || '')}
                </span>
              </div>
            </div>
            <div className="flex border-t border-gray-100 pt-3">
              <Link
                href={`/technical-visits/${visit._id}`}
                className="flex-1 inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors cursor-pointer"
              >
                Ver
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
