'use client';

import Link from 'next/link';
import { TimelineCardProps } from '../types/timeline';

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

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp', call: 'Llamada', form: 'Formulario',
  referral: 'Referido', walk_in: 'Presencial', other: 'Otro',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo', contacted: 'Contactado', quote_sent: 'Presupuesto enviado',
  technical_visit: 'Visita técnica', negotiation: 'Negociación', qualified: 'Calificado',
  won: 'Ganado', lost: 'Perdido', disqualified: 'Descalificado',
};

export function TimelineCardLead({ event }: TimelineCardProps) {
  const meta = event.metadata ?? {};
  const eventType = event.eventType;

  const renderContent = () => {
    switch (eventType) {
      case 'lead.created': {
        const name = (meta.name as string) || event.title;
        const source = SOURCE_LABELS[meta.source as string] || (meta.source as string) || '';
        const email = meta.email as string | undefined;
        const phone = meta.phone as string | undefined;
        const company = meta.companyName as string | undefined;

        return (
          <>
            <p className="text-xs font-medium text-blue-600">Lead creado</p>
            <h4 className="text-sm font-semibold text-gray-900">{name}</h4>
            <div className="mt-1 space-y-0.5">
              {source && (
                <p className="text-xs text-gray-500">
                  <span className="font-medium">Fuente:</span> {source}
                </p>
              )}
              {company && (
                <p className="text-xs text-gray-500">
                  <span className="font-medium">Empresa:</span> {company}
                </p>
              )}
              {email && (
                <p className="text-xs text-gray-500">
                  <span className="font-medium">Email:</span> {email}
                </p>
              )}
              {phone && (
                <p className="text-xs text-gray-500">
                  <span className="font-medium">Tel:</span> {phone}
                </p>
              )}
            </div>
          </>
        );
      }

      case 'lead.status_changed': {
        const fromLabel = (meta.fromLabel as string) || (meta.from as string) || '';
        const toLabel = (meta.toLabel as string) || (meta.to as string) || '';
        const leadName = meta.leadName as string | undefined;

        return (
          <>
            <p className="text-xs font-medium text-gray-500">Cambio de estado</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{fromLabel}</span>
              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{toLabel}</span>
            </div>
            {leadName && (
              <p className="text-xs text-gray-400 mt-1">{leadName}</p>
            )}
          </>
        );
      }

      case 'lead.converted': {
        const clientName = meta.clientName as string | undefined;
        const clientId = meta.clientId as string | undefined;

        return (
          <>
            <p className="text-xs font-medium text-green-600">Convertido a cliente</p>
            <div className="mt-1">
              {clientName ? (
                <p className="text-sm text-gray-700 font-medium">{clientName}</p>
              ) : clientId ? (
                <p className="text-xs text-gray-500">Cliente ID: {clientId}</p>
              ) : null}
            </div>
          </>
        );
      }

      default:
        return <h4 className="text-sm font-medium text-gray-900">{event.title}</h4>;
    }
  };

  const route = `/leads/${event.entityId}`;

  return (
    <>
      {renderContent()}
      <p className="text-xs text-gray-400 mt-1">
        {formatFullDate(event.createdAt)} · {getUserName(event.createdBy)}
      </p>
      <div className="mt-2 pt-2 border-t border-gray-100">
        <Link
          href={route}
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          Ver lead →
        </Link>
      </div>
    </>
  );
}
