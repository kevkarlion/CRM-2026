'use client';

import Link from 'next/link';
import { TimelineCardProps } from '../types/timeline';
import { resolveEntityRoute, getEntityNumber } from '../helpers/entity-routes';
import { formatDateLong } from '@/operations/helpers/date-utils';

function getUserName(
  user:
    | { _id: string; firstName?: string; lastName?: string; email?: string }
    | string,
): string {
  if (typeof user === 'string') return user;
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user._id;
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-50 text-blue-600',
  confirmed: 'bg-teal-50 text-teal-600',
  assigned: 'bg-indigo-50 text-indigo-600',
  en_route: 'bg-purple-50 text-purple-600',
  on_site: 'bg-cyan-50 text-cyan-600',
  paused: 'bg-yellow-50 text-yellow-600',
  completed: 'bg-green-50 text-green-600',
  cancelled: 'bg-red-50 text-red-600',
  closed: 'bg-gray-100 text-gray-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-50 text-gray-500',
  normal: 'bg-blue-50 text-blue-600',
  high: 'bg-orange-50 text-orange-600',
  urgent: 'bg-red-50 text-red-600',
  emergency: 'bg-red-100 text-red-700 font-semibold',
};

export function TimelineCardWorkOrder({ event }: TimelineCardProps) {
  const meta = event.metadata ?? {};
  const entityNumber = getEntityNumber(meta, event.title);
  const status = meta.status as string | undefined;
  const statusLabel = meta.statusLabel as string | undefined;
  const categoryLabel = meta.categoryLabel as string | undefined;
  const priorityLabel = meta.priorityLabel as string | undefined;
  const title = meta.title as string | undefined;
  const clientName = meta.clientName as string | undefined;
  const address = meta.address as string | undefined;
  const scheduledDate = meta.scheduledDate as string | undefined;
  const route = resolveEntityRoute(event.entityType, event.entityId);

  const isStatusChange = event.eventType === 'workorder.status_changed';
  const isCompleted = event.eventType === 'workorder.completed';
  const isCreated = event.eventType === 'workorder.created';

  const getEventTitle = () => {
    if (isCompleted) return 'OT completada';
    if (isCreated) return 'OT creada';
    if (isStatusChange) return 'OT — cambio de estado';
    return 'Orden de Trabajo';
  };

  const fromLabel = meta.fromLabel as string | undefined;
  const toLabel = meta.toLabel as string | undefined;

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-600">{getEventTitle()}</p>
          <h4 className="text-sm font-semibold text-gray-900">
            {entityNumber || `OT #${event.entityId?.slice(-4)}`}
          </h4>
          {title && (
            <p className="text-xs text-gray-600 mt-0.5">{title}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            {formatFullDate(event.createdAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {statusLabel && (
            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${(status ? STATUS_COLORS[status] : '') || 'bg-gray-100 text-gray-600'}`}>
              {statusLabel}
            </span>
          )}
          {isStatusChange && fromLabel && toLabel && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span className="px-1.5 py-0.5 rounded bg-gray-100">{fromLabel}</span>
              <span>→</span>
              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{toLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* Details section */}
      <div className="mt-2 space-y-1">
        {categoryLabel && (
          <p className="text-xs text-gray-600">
            📋 {categoryLabel}
            {priorityLabel && (
              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${PRIORITY_COLORS[meta.priority as string] || 'bg-gray-50 text-gray-500'}`}>
                {priorityLabel}
              </span>
            )}
          </p>
        )}

        {clientName && (
          <p className="text-xs text-gray-600">👤 {clientName}</p>
        )}

        {address && (
          <p className="text-xs text-gray-500">📍 {address}</p>
        )}

        {scheduledDate && !isStatusChange && (
          <p className="text-xs text-gray-600">
            📅 {formatDateLong(scheduledDate)}
          </p>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-1">
        {getUserName(event.createdBy)}
      </p>

      {route !== '#' && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <Link
            href={route}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Ver OT →
          </Link>
        </div>
      )}
    </>
  );
}
