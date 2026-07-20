'use client';

import Link from 'next/link';
import { TimelineCardProps } from '../types/timeline';
import { resolveEntityRoute, getEntityNumber } from '../helpers/entity-routes';

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `hace ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
  if (diffHours < 24) return `hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
  if (diffDays === 1) return 'ayer';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'ayer';

  return date.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getUserName(
  user:
    | { _id: string; firstName?: string; lastName?: string; email?: string }
    | string,
): string {
  if (typeof user === 'string') return user;
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user._id;
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

function getExpiryLabel(validUntil?: string): {
  text: string;
  variant: string;
} | null {
  if (!validUntil) return null;

  const now = new Date();
  const expiry = new Date(validUntil);
  const diffDays = Math.ceil(
    (expiry.getTime() - now.getTime()) / 86400000,
  );

  if (diffDays < 0) return { text: 'Vencida', variant: 'text-red-600 bg-red-50' };
  if (diffDays === 0) return { text: 'Vence hoy', variant: 'text-orange-600 bg-orange-50' };
  return { text: `${diffDays}d`, variant: 'text-yellow-600 bg-yellow-50' };
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  expired: 'Expirado',
  cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-50 text-blue-600',
  approved: 'bg-green-50 text-green-600',
  rejected: 'bg-red-50 text-red-600',
  expired: 'bg-yellow-50 text-yellow-600',
  cancelled: 'bg-gray-100 text-gray-400',
};

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TimelineCardQuote({ event }: TimelineCardProps) {
  const entityNumber = getEntityNumber(event.metadata, event.title);
  const amount = event.metadata?.amount || event.metadata?.total;
  const status = event.metadata?.status as string | undefined;
  const validUntil = event.metadata?.validUntil as string | undefined;
  const title = event.metadata?.title as string | undefined;
  const description = event.metadata?.description as string | undefined;
  const notes = event.metadata?.notes as string | undefined;
  const expiry = getExpiryLabel(validUntil);
  const route = resolveEntityRoute(event.entityType, event.entityId);

  const statusLabel = status ? STATUS_LABELS[status] || status : null;
  const statusColor = status ? STATUS_COLORS[status] || 'bg-gray-100 text-gray-600' : '';

  const getEventTitle = () => {
    if (event.eventType === 'quote.created') return 'Presupuesto creado';
    if (event.eventType === 'quote.sent') return 'Presupuesto enviado';
    if (event.eventType === 'quote.approved') return 'Presupuesto aprobado';
    if (event.eventType === 'quote.rejected') return 'Presupuesto rechazado';
    if (event.eventType === 'quote.converted') return 'Convertido a OT';
    return 'Presupuesto';
  };

  const getEventColor = () => {
    if (event.eventType === 'quote.approved') return 'text-green-600';
    if (event.eventType === 'quote.rejected') return 'text-red-600';
    if (event.eventType === 'quote.sent') return 'text-indigo-600';
    return 'text-purple-600';
  };

  const rejectionReason = event.metadata?.reason as string | undefined;
  const workOrderNumber = event.metadata?.workOrderNumber as string | undefined;

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-medium ${getEventColor()}`}>{getEventTitle()}</p>
          <h4 className="text-sm font-semibold text-gray-900">{entityNumber}</h4>
          {title && (
            <p className="text-sm text-gray-700 mt-0.5">{title}</p>
          )}
          {description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{description}</p>
          )}
          {workOrderNumber && (
            <p className="text-xs text-green-600 mt-0.5 font-medium">
              OT #{workOrderNumber}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            {formatFullDate(event.createdAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {statusLabel && (
            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColor}`}>
              {statusLabel}
            </span>
          )}
          {expiry && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${expiry.variant}`}>
              {expiry.text}
            </span>
          )}
        </div>
      </div>

      {amount && (
        <div className="mt-2">
          <span className="text-lg font-bold text-gray-800">
            {formatCurrency(amount)}
          </span>
        </div>
      )}

      {event.summary && !amount && (
        <p className="text-sm text-gray-600 mt-1">{event.summary}</p>
      )}

      {notes && (
        <p className="text-xs text-gray-500 mt-1 italic">{notes}</p>
      )}

      {rejectionReason && (
        <div className="mt-1 p-2 bg-red-50 rounded text-xs text-red-600">
          <span className="font-medium">Motivo de rechazo:</span> {rejectionReason}
        </div>
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
            Ver detalle →
          </Link>
        </div>
      )}
    </>
  );
}
