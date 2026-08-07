'use client';

import { EntityEmptyState } from '@/components/entity-detail';
import {
  TECHNICAL_VISIT_PRIORITY_VARIANT,
  TECHNICAL_VISIT_STATUS_VARIANT,
} from '@/operations/constants/status-colors';
import { formatShortDate } from './lead-detail.constants';
import type { VisitListItem } from './lead-detail.types';

interface LeadVisitsTabProps {
  visits: VisitListItem[];
  loading: boolean;
  canCreate: boolean;
  onNewVisit: () => void;
}

export function LeadVisitsTab({ visits, loading, canCreate, onNewVisit }: LeadVisitsTabProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-40 rounded bg-gray-200 animate-pulse" />
        {[1, 2].map((i) => (
          <div key={i} className="h-20 w-full rounded-xl bg-gray-100 animate-pulse" />
        ))}
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-gray-900">
          Visitas técnicas{' '}
          <span className="font-normal text-gray-500">({visits.length})</span>
        </h2>
        {canCreate && (
          <button
            onClick={onNewVisit}
            className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
          >
            Programar Visita Técnica
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {visits.map((visit) => (
          <div key={visit._id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{visit.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">#{visit.visitNumber}</p>
                {visit.locationSnapshot?.address && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    📍 {visit.locationSnapshot.address}
                    {visit.locationSnapshot.city ? `, ${visit.locationSnapshot.city}` : ''}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    TECHNICAL_VISIT_STATUS_VARIANT[visit.status] || 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {visit.status}
                </span>
                <p className="mt-1 text-xs text-gray-500">
                  {formatShortDate(visit.scheduledDate)}
                </p>
                {visit.priority && (
                  <p
                    className={`mt-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      TECHNICAL_VISIT_PRIORITY_VARIANT[visit.priority] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {visit.priority}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
