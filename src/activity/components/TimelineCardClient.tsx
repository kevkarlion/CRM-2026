'use client';

import { TimelineCardProps } from '../types/timeline';
import { resolveEntityRoute, getEntityNumber } from '../helpers/entity-routes';

export function TimelineCardClient({ event }: { event: TimelineCardProps['event'] }) {
  const sourceId = event.metadata?.sourceId as string | undefined;
  const sourceNumber = getEntityNumber(event.metadata, 'Ver');

  // Determine which entity type to link based on event type
  let linkEntityType = 'client';
  let linkEntityId = event.entityId;

  // For client-scoped events from quotes, visits, work orders, use those entity routes
  if (event.eventType?.startsWith('quote.')) {
    linkEntityType = 'quote';
  } else if (event.eventType?.startsWith('visit.')) {
    linkEntityType = 'visit';
  } else if (event.eventType?.startsWith('workorder.')) {
    linkEntityType = 'work_order';
  }

  const href = resolveEntityRoute(linkEntityType, linkEntityId || sourceId || '');

  // Get icon and color from metadata or use defaults
  const icon = (event.metadata?.icon as string) || event.icon || 'building';
  const color = (event.metadata?.color as string) || event.color || 'blue';

  const colorMap: Record<string, string> = {
    blue: 'border-blue-500',
    green: 'border-green-500',
    yellow: 'border-yellow-500',
    orange: 'border-orange-500',
    red: 'border-red-500',
    purple: 'border-purple-500',
    indigo: 'border-indigo-500',
    gray: 'border-gray-500',
  };

  const iconBgMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    orange: 'bg-orange-100 text-orange-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    gray: 'bg-gray-100 text-gray-600',
  };

  return (
    <div>
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${iconBgMap[color] || iconBgMap.blue}`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {icon === 'building' && (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            )}
            {icon === 'file-text' && (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            )}
            {icon === 'calendar' && (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            )}
            {icon === 'tool' && (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
            )}
            {icon === 'check-circle' && (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            )}
            {icon === 'status' && (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            )}
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-gray-900">{event.title}</p>
          </div>
          {event.summary && (
            <p className="text-sm text-gray-500 mt-0.5">{event.summary}</p>
          )}
          {sourceId && (
            <a
              href={href}
              className="text-sm text-brand-600 hover:text-brand-700 mt-1 inline-block"
            >
              {sourceNumber}
            </a>
          )}
          {typeof event.metadata?.description === 'string' && (
            <p className="text-sm text-gray-500 mt-1">
              {event.metadata.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
