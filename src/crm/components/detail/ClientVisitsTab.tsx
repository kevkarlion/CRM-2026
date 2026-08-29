'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { EntityEmptyState } from '@/components/entity-detail';
import { api, unwrapData } from '@/lib/api-client';
import { formatDateShort } from '@/operations/helpers/date-utils';
import { TECHNICAL_VISIT_STATUS_LABELS } from '@/operations/constants/status-labels';

// Badges sólidos para las cards (la tabla desktop conserva las variantes pastel)
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

interface VisitListItem {
  _id: string;
  visitNumber: string;
  title: string;
  status: string;
  priority?: string;
  scheduledDate?: string | null;
  createdAt?: string;
}

interface ClientVisitsTabProps {
  clientId: string;
}

export function ClientVisitsTab({ clientId }: ClientVisitsTabProps) {
  const [visits, setVisits] = useState<VisitListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadVisits() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<{ data: VisitListItem[] }>('/api/operations/technical-visits', {
          clientId,
          limit: '50',
        });
        if (!cancelled) {
          setVisits(unwrapData<VisitListItem[]>(res));
        }
      } catch (err) {
        console.error('Error loading client visits:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar visitas técnicas');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadVisits();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-40 rounded bg-gray-200 animate-pulse" />
        {[1, 2].map((i) => (
          <div key={i} className="h-24 w-full rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
        {error}
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
              d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 8a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17h3.839c.278 0 .554-.042.82-.122M19 9.34V7a3 3 0 00-3-3h-5m1 4v1.5m-5.5 8.5h.5"
            />
          </svg>
        }
        title="No hay visitas técnicas"
        description="Este cliente aún no tiene visitas técnicas asociadas."
      />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">
        Visitas técnicas{' '}
        <span className="font-normal text-gray-500">({visits.length})</span>
      </h2>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {visits.map((visit) => (
          <Link
            key={visit._id}
            href={`/technical-visits/${visit._id}`}
            className="block rounded-xl border border-gray-200 border-l-4 border-l-teal-600 bg-white p-4 shadow-sm transition-colors hover:border-gray-300"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 hover:text-brand-600 transition-colors">
                  {visit.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">#{visit.visitNumber}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatDateShort(visit.scheduledDate || visit.createdAt)}
                </p>
              </div>
              <div className="shrink-0">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TECHNICAL_VISIT_STATUS_VARIANT_MOBILE[visit.status] || 'bg-gray-200 text-gray-800'}`}
                >
                  {TECHNICAL_VISIT_STATUS_LABELS[visit.status as keyof typeof TECHNICAL_VISIT_STATUS_LABELS] || visit.status}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
