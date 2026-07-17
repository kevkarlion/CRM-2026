'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { formatDateShort } from '@/lib/format-date';

interface Activity {
  _id: string;
  eventType: string;
  title: string;
  summary?: string;
  icon?: string;
  color?: string;
  createdAt: string;
  createdBy?: any;
}

interface ActivityTimelineProps {
  entityType: string;
  entityId: string;
}

const EVENT_COLORS: Record<string, string> = {
  'quote.created': 'bg-blue-500',
  'quote.sent': 'bg-indigo-500',
  'quote.approved': 'bg-green-500',
  'quote.rejected': 'bg-red-500',
  'quote.cancelled': 'bg-gray-500',
  'quote.expired': 'bg-orange-500',
  'quote.converted': 'bg-emerald-500',
  'negotiation.created': 'bg-amber-500',
  'negotiation.counteroffer': 'bg-purple-500',
  'negotiation.status_changed': 'bg-gray-500',
  'lead.created': 'bg-blue-500',
  'lead.status_changed': 'bg-cyan-500',
  'lead.converted': 'bg-green-500',
};

function getUserDisplay(user: any): string {
  if (!user) return '—';
  if (typeof user === 'string') return '—';
  if (user.firstName || user.lastName) {
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  }
  return user.email || '—';
}

export function ActivityTimeline({ entityType, entityId }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadActivities() {
      try {
        setLoading(true);
        setError(false);

        if (entityType === 'quote') {
          const data = await api.get<any>(`/api/crm/quotes/${entityId}/activities`).catch(() => null);
          if (data && Array.isArray(data)) {
            setActivities(data);
          } else {
            setActivities([]);
            setError(true);
          }
        } else if (entityType === 'negotiation') {
          setActivities([]);
          setError(true);
        } else {
          setActivities([]);
          setError(true);
        }
      } catch {
        setActivities([]);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadActivities();
  }, [entityType, entityId]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Actividad</h3>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-3 w-3 rounded-full bg-gray-200 animate-pulse mt-1" />
              <div className="flex-1">
                <div className="h-4 w-32 animate-pulse rounded bg-gray-200 mb-1" />
                <div className="h-3 w-48 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Actividad</h3>

      {error || activities.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 mb-1">Próximamente</p>
          <p className="text-xs text-gray-400">El timeline de actividad estará disponible pronto</p>
        </div>
      ) : (
        <div className="space-y-0 relative">
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-gray-200" />
          {activities.map(activity => (
            <div key={activity._id} className="relative flex items-start gap-3 pb-4 last:pb-0">
              <div className={`relative z-10 h-3 w-3 rounded-full mt-1.5 shrink-0 ${EVENT_COLORS[activity.eventType] || 'bg-gray-400'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                {activity.summary && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{activity.summary}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">{formatDateShort(activity.createdAt)}</span>
                  {activity.createdBy && (
                    <span className="text-xs text-gray-400">· {getUserDisplay(activity.createdBy)}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
