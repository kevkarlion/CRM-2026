'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { TimelineEvent } from './TimelineEvent';

interface TimelineEventData {
  _id: string;
  eventType: string;
  title: string;
  summary?: string;
  icon?: string;
  color?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdBy: { _id: string; firstName?: string; lastName?: string; email?: string } | string;
  createdAt: string;
}

interface LeadTimelineProps {
  leadId: string;
  refreshKey?: number;
}

function SkeletonRow() {
  return (
    <div className="flex gap-3 py-3 animate-pulse">
      <div className="w-2 h-2 rounded-full bg-gray-200 mt-1.5" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  );
}

export function LeadTimeline({ leadId, refreshKey = 0 }: LeadTimelineProps) {
  const [activities, setActivities] = useState<TimelineEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchActivities() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get<TimelineEventData[]>(
          `/api/crm/leads/${leadId}/activity`,
        );
        if (!cancelled) setActivities(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Error al cargar la actividad',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchActivities();
    return () => { cancelled = true; };
  }, [leadId, refreshKey]);

  if (loading) {
    return (
      <div>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-danger-600">{error}</p>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-400">No hay actividad registrada</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {activities.map((event) => (
        <TimelineEvent key={event._id} event={event} />
      ))}
    </div>
  );
}
