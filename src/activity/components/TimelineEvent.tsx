'use client';

import { TimelineCardProps } from '../types/timeline';
import { TimelineCardLead } from './TimelineCardLead';
import { TimelineCardQuote } from './TimelineCardQuote';
import { TimelineCardNegotiation } from './TimelineCardNegotiation';
import { TimelineCardVisit } from './TimelineCardVisit';
import { TimelineCardWorkOrder } from './TimelineCardWorkOrder';

const CARD_REGISTRY: Record<string, React.ComponentType<TimelineCardProps>> = {
  lead: TimelineCardLead,
  quote: TimelineCardQuote,
  negotiation: TimelineCardNegotiation,
  visit: TimelineCardVisit,
  work_order: TimelineCardWorkOrder,
};

interface TimelineEventProps {
  event: {
    _id?: string;
    eventType: string;
    title: string;
    summary?: string;
    icon?: string;
    color?: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    createdBy:
      | { _id: string; firstName?: string; lastName?: string; email?: string }
      | string;
    createdAt: string;
  };
}

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

function getBorderColor(color?: string): string {
  const map: Record<string, string> = {
    'bg-blue-500': '#3b82f6',
    'bg-yellow-500': '#eab308',
    'bg-green-500': '#22c55e',
    'bg-orange-500': '#f97316',
    'bg-indigo-500': '#6366f1',
    'bg-slate-500': '#64748b',
    'bg-gray-500': '#6b7280',
    'bg-red-500': '#ef4444',
    'bg-purple-500': '#a855f7',
  };
  return color ? map[color] ?? '#3b82f6' : '#3b82f6';
}

export function TimelineEvent({ event }: TimelineEventProps) {
  const dotColor = event.color || 'bg-blue-500';
  const entityType = event.entityType;
  const CardComponent =
    entityType && entityType in CARD_REGISTRY
      ? CARD_REGISTRY[entityType]
      : null;

  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="flex flex-col items-center">
        <div className={`w-2 h-2 rounded-full mt-1.5 ${dotColor}`} />
        <div className="w-px flex-1 bg-gray-200 mt-1" />
      </div>
      <div className="flex-1 min-w-0">
        {CardComponent ? (
          <div
            className="border-l-4 pl-4 py-3"
            style={{ borderLeftColor: getBorderColor(event.color) }}
          >
            <CardComponent
              event={
                {
                  _id: event._id ?? '',
                  eventType: event.eventType,
                  title: event.title,
                  summary: event.summary,
                  icon: event.icon,
                  color: event.color,
                  entityType: event.entityType ?? '',
                  entityId: event.entityId ?? '',
                  metadata: event.metadata,
                  createdBy: event.createdBy,
                  createdAt: event.createdAt,
                } as TimelineCardProps['event']
              }
            />
          </div>
        ) : (
          <div className="pl-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-gray-900">
                {event.title}
              </p>
              <time className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                {formatRelativeTime(event.createdAt)}
              </time>
            </div>
            {event.summary && (
              <p className="text-sm text-gray-500 mt-0.5">{event.summary}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {getUserName(event.createdBy)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
