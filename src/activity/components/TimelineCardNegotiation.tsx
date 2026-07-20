'use client';

import Link from 'next/link';
import { TimelineCardProps } from '../types/timeline';
import { resolveEntityRoute } from '../helpers/entity-routes';

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

function formatCurrency(value: unknown): string {
  const num = Number(value);
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(num);
}

function formatNextFollowUp(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / 86400000);

  if (diffDays < 0) return 'Seguimiento pendiente';
  if (diffDays === 0) return 'Seguimiento hoy';
  if (diffDays === 1) return 'Seguimiento mañana';
  return `Seguimiento en ${diffDays} días`;
}

export function TimelineCardNegotiation({ event }: TimelineCardProps) {
  const meta = event.metadata ?? {};
  const reason = meta.reason as string | undefined;
  const nextFollowUp = meta.nextFollowUp as string | undefined;
  const initialAmount = meta.initialAmount as number | undefined;
  const finalAmount = meta.finalAmount as number | undefined;
  const leadName = meta.leadName as string | undefined;
  const route = resolveEntityRoute(event.entityType, event.entityId);

  const isCreated = event.eventType === 'negotiation.opened' || event.eventType === 'negotiation.created';
  const isAccepted = event.eventType === 'negotiation.accepted';
  const isRejected = event.eventType === 'negotiation.rejected';

  const getEventTitle = () => {
    if (isCreated) return 'Negociación iniciada';
    if (isAccepted) return 'Negociación aceptada';
    if (isRejected) return 'Negociación rechazada';
    return 'Negociación';
  };

  const getEventColor = () => {
    if (isAccepted) return 'text-green-600';
    if (isRejected) return 'text-red-600';
    return 'text-orange-600';
  };

  const amount = finalAmount || initialAmount;

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-medium ${getEventColor()}`}>{getEventTitle()}</p>
          <h4 className="text-sm font-semibold text-gray-900">
            {event.title || `Negociación #${event.entityId?.slice(-4)}`}
          </h4>
          {leadName && (
            <p className="text-xs text-gray-500 mt-0.5">Lead: {leadName}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            {formatFullDate(event.createdAt)}
          </p>
        </div>
      </div>

      {event.summary && (
        <p className="text-sm text-gray-600 mt-2">{event.summary}</p>
      )}

      {reason && (
        <div className="mt-1 p-2 bg-gray-50 rounded text-xs text-gray-600">
          <span className="font-medium">Motivo:</span> {reason}
        </div>
      )}

      {amount && (
        <p className="text-base font-bold text-gray-800 mt-2">
          {formatCurrency(amount)}
        </p>
      )}

      {isAccepted && finalAmount && initialAmount && finalAmount !== initialAmount && (
        <p className="text-xs text-gray-500 mt-0.5">
          Monto original: {formatCurrency(initialAmount)}
        </p>
      )}

      {nextFollowUp && (
        <p className="text-xs text-amber-600 mt-2 bg-amber-50 px-2 py-1 rounded inline-block">
          📅 {formatNextFollowUp(nextFollowUp)}
        </p>
      )}

      <p className="text-xs text-gray-500 mt-1">
        {getUserName(event.createdBy)}
      </p>

      {route !== '#' && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <Link
            href={route}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Ver negociación →
          </Link>
        </div>
      )}
    </>
  );
}
