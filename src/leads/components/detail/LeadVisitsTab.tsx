'use client';

import Link from 'next/link';

import { EntityEmptyState } from '@/components/entity-detail';
import { formatDateShort } from '@/operations/helpers/date-utils';
import { TECHNICAL_VISIT_STATUS_LABELS } from '@/operations/constants/status-labels';
import { TECHNICAL_VISIT_STATUS_VARIANT } from '@/operations/constants/status-colors';
import type { VisitListItem } from './lead-detail.types';

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
      <div className="overflow-hidden rounded-lg border border-gray-200">
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
    const aDate = a.scheduledDate || a.createdAt || '';
    const bDate = b.scheduledDate || b.createdAt || '';
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

      <div className="overflow-hidden rounded-lg border border-gray-200">
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
                  {formatDateShort(visit.scheduledDate || visit.createdAt)}
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
    </div>
  );
}
