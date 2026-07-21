'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { CalendarView } from '@/operations/components/centro-operativo/CalendarView';
import { TechnicianAgendaSummary } from '@/operations/components/centro-operativo/TechnicianAgendaSummary';
import { SelfAssignmentDrawer } from '@/operations/components/SelfAssignmentDrawer';
import type { CalendarEvent } from '@/operations/types/centro-operativo';

interface UnassignedWorkOrder {
  _id: string;
  workOrderNumber: string;
  title: string;
  status: string;
  priority: string;
  scheduledDate?: string;
  clientSnapshot?: { name?: string };
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getWeekStart(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
}

export default function TechnicianCalendarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [unassignedOrders, setUnassignedOrders] = useState<UnassignedWorkOrder[]>([]);

  const [selfAssignOpen, setSelfAssignOpen] = useState(false);
  const [selfAssignWO, setSelfAssignWO] = useState<{ id: string; number: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      const startOfWeek = getWeekStart(now);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 7);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);

      const startDate = startOfMonth < startOfWeek ? startOfMonth : startOfWeek;
      const endDate = endOfMonth > endOfWeek ? endOfMonth : endOfWeek;

      const [calendarResult, unassignedResult] = await Promise.allSettled([
        api.get<{ data: CalendarEvent[]; technicianId: string }>(
          '/api/operations/work-orders/technician',
          {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        ),
        api.get<{ data: UnassignedWorkOrder[] }>('/api/operations/work-orders', {
          status: 'scheduled',
        }),
      ]);

      if (calendarResult.status === 'fulfilled') {
        setEvents(calendarResult.value.data || []);
      } else {
        setError(calendarResult.reason instanceof Error ? calendarResult.reason.message : 'Error al cargar calendario');
      }

      if (unassignedResult.status === 'fulfilled') {
        const raw = unassignedResult.value;
        const list = Array.isArray(raw) ? raw : raw?.data || [];
        setUnassignedOrders(
          list.filter(
            (wo: UnassignedWorkOrder) =>
              wo.status === 'scheduled' || wo.status === 'confirmed',
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleEventClick(eventId: string) {
    router.push(`/work-orders/${eventId}`);
  }

  const { todayCount, weekCount, nextJob } = useMemo(() => {
    const now = new Date();
    const todayEvents = events.filter((e) => isSameDay(new Date(e.scheduledDate), now));
    const weekStart = getWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEvents = events.filter((e) => {
      const d = new Date(e.scheduledDate);
      return d >= weekStart && d < weekEnd;
    });

    const upcoming = events
      .filter((e) => new Date(e.scheduledDate) >= now)
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

    const next = upcoming[0];

    return {
      todayCount: todayEvents.length,
      weekCount: weekEvents.length,
      nextJob: next
        ? {
            title: next.title,
            time: next.scheduledStart
              ? new Date(next.scheduledStart).toLocaleTimeString('es-CL', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : new Date(next.scheduledDate).toLocaleDateString('es-CL', {
                  day: '2-digit',
                  month: '2-digit',
                }),
            client: next.clientSnapshot?.name || '',
          }
        : undefined,
    };
  }, [events]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mis Órdenes</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? 'Cargando...' : `${events.length} órdenes asignadas`}
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="Actualizar"
          >
            <svg
              className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        )}

        {!loading && (
          <TechnicianAgendaSummary
            todayCount={todayCount}
            weekCount={weekCount}
            nextJob={nextJob}
          />
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            <div className="h-[500px] bg-gray-100 rounded-xl animate-pulse" />
          </div>
        ) : (
          <CalendarView events={events} onEventClick={handleEventClick} />
        )}

        {unassignedOrders.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                Disponibles para auto-asignar
              </h2>
              <span className="text-xs text-gray-400">{unassignedOrders.length} órdenes</span>
            </div>

            <div className="space-y-2">
              {unassignedOrders.slice(0, 5).map((wo) => (
                <div
                  key={wo._id}
                  className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{wo.title}</p>
                    <p className="text-xs text-gray-400">
                      #{wo.workOrderNumber}
                      {wo.clientSnapshot?.name && ` · ${wo.clientSnapshot.name}`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelfAssignWO({ id: wo._id, number: wo.workOrderNumber });
                      setSelfAssignOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 text-xs font-medium hover:bg-brand-100 transition-colors whitespace-nowrap"
                  >
                    Auto-asignar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selfAssignWO && (
        <SelfAssignmentDrawer
          isOpen={selfAssignOpen}
          onClose={() => {
            setSelfAssignOpen(false);
            setSelfAssignWO(null);
          }}
          workOrderId={selfAssignWO.id}
          workOrderNumber={selfAssignWO.number}
          onAssigned={fetchData}
        />
      )}
    </div>
  );
}
