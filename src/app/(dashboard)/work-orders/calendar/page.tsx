'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '@/dashboard/context/role-context';
import { api } from '@/lib/api-client';
import { CalendarView } from '@/operations/components/centro-operativo/CalendarView';
import { TechnicianAgendaSummary } from '@/operations/components/centro-operativo/TechnicianAgendaSummary';
import { SelfAssignmentDrawer } from '@/operations/components/SelfAssignmentDrawer';
import { SelfAssignmentVisitDrawer } from '@/operations/components/SelfAssignmentVisitDrawer';
import { parseLocalDate } from '@/operations/helpers/date-utils';
import type { CalendarEvent } from '@/operations/types/centro-operativo';

interface UnassignedWorkOrder {
  _id: string;
  workOrderNumber: string;
  title: string;
  status: string;
  priority: string;
  scheduledDate?: string;
  clientSnapshot?: { name?: string };
  type: 'work_order';
}

interface UnassignedVisit {
  _id: string;
  visitNumber: string;
  title: string;
  status: string;
  priority: string;
  scheduledDate?: string;
  clientSnapshot?: { name?: string };
  type: 'technical_visit';
}

type UnassignedItem = UnassignedWorkOrder | UnassignedVisit;

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
  const { isTechnician, isAdmin, loading: roleLoading } = useRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [unassignedOrders, setUnassignedOrders] = useState<UnassignedItem[]>([]);

  const [selfAssignOpen, setSelfAssignOpen] = useState(false);
  const [selfAssignWO, setSelfAssignWO] = useState<{ id: string; number: string; type: 'work_order' | 'technical_visit' } | null>(null);

  // Show loading while role is being determined
  if (roleLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 bg-gray-200 rounded-xl animate-pulse" />
          <div className="h-[500px] bg-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const fetchData = useCallback(async () => {
    // Don't fetch until role is determined
    if (roleLoading) return;

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

      // Always use the all-calendar endpoint for technicians and admins
      // This shows ALL work orders and technical visits
      const calendarEndpoint = (isTechnician || isAdmin)
        ? '/api/operations/work-orders/all-calendar'
        : '/api/operations/work-orders/technician';

      console.log('[Calendar] Fetching from:', calendarEndpoint, { isTechnician, isAdmin });

      const [calendarResult, workOrdersResult, visitsResult] = await Promise.allSettled([
        api.get<{ data: CalendarEvent[]; total?: number; technicianId?: string }>(calendarEndpoint, {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
        api.get<{ data: UnassignedWorkOrder[] }>('/api/operations/work-orders', {
          status: 'scheduled',
        }),
        api.get<{ data: UnassignedVisit[] }>('/api/operations/technical-visits', {
          status: 'scheduled',
        }),
      ]);

      if (calendarResult.status === 'fulfilled') {
        const data = calendarResult.value.data || [];
        console.log('[Calendar] Received events:', data.length);
        setEvents(data);
      } else {
        console.error('[Calendar] Error fetching calendar:', calendarResult.reason);
        setError(calendarResult.reason instanceof Error ? calendarResult.reason.message : 'Error al cargar calendario');
      }

      // Combine unassigned work orders and visits
      const unassigned: UnassignedItem[] = [];

      if (workOrdersResult.status === 'fulfilled') {
        const rawWO = workOrdersResult.value;
        const listWO = Array.isArray(rawWO) ? rawWO : rawWO?.data || [];
        unassigned.push(
          ...listWO
            .filter((wo: UnassignedWorkOrder) => wo.status === 'scheduled' || wo.status === 'confirmed')
            .map((wo: UnassignedWorkOrder) => ({ ...wo, type: 'work_order' as const }))
        );
      }

      if (visitsResult.status === 'fulfilled') {
        const rawTV = visitsResult.value;
        const listTV = Array.isArray(rawTV) ? rawTV : rawTV?.data || [];
        unassigned.push(
          ...listTV
            .filter((tv: UnassignedVisit) => tv.status === 'scheduled' || tv.status === 'confirmed')
            .map((tv: UnassignedVisit) => ({ ...tv, type: 'technical_visit' as const }))
        );
      }

      setUnassignedOrders(unassigned);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [isTechnician, isAdmin, roleLoading]);

  useEffect(() => {
    if (!roleLoading) {
      fetchData();
    }
  }, [roleLoading, fetchData]);

  function handleEventClick(event: CalendarEvent) {
    if (event.type === 'technical_visit') {
      router.push(`/technical-visits/${event._id}`);
    } else {
      router.push(`/work-orders/${event._id}`);
    }
  }

  const { todayCount, weekCount, nextJob } = useMemo(() => {
    const now = new Date();
    const todayEvents = events.filter((e) => isSameDay(parseLocalDate(e.scheduledDate), now));
    const weekStart = getWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEvents = events.filter((e) => {
      const d = parseLocalDate(e.scheduledDate);
      return d >= weekStart && d < weekEnd;
    });

    const upcoming = events
      .filter((e) => parseLocalDate(e.scheduledDate) >= now)
      .sort((a, b) => parseLocalDate(a.scheduledDate).getTime() - parseLocalDate(b.scheduledDate).getTime());

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
              : (() => {
                  return parseLocalDate(next.scheduledDate).toLocaleDateString('es-CL', {
                    day: '2-digit',
                    month: '2-digit',
                  });
                })(),
            client: next.clientSnapshot?.name || '',
          }
        : undefined,
    };
  }, [events]);

  const handleSelfAssign = (item: UnassignedItem) => {
    if (item.type === 'work_order') {
      setSelfAssignWO({ id: item._id, number: item.workOrderNumber, type: 'work_order' });
    } else {
      setSelfAssignWO({ id: item._id, number: item.visitNumber, type: 'technical_visit' });
    }
    setSelfAssignOpen(true);
  };

  const pageTitle = isTechnician ? 'Todas las Órdenes' : 'Mis Órdenes';
  const description = isTechnician 
    ? `${events.length} órdenes y visitas técnicas`
    : `${events.length} órdenes asignadas`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{pageTitle}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? 'Cargando...' : description}
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

        {/* Unassigned items for self-assignment - show only to technicians */}
        {isTechnician && unassignedOrders.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                Disponibles para auto-asignar
              </h2>
              <span className="text-xs text-gray-400">{unassignedOrders.length} ítems</span>
            </div>

            <div className="space-y-2">
              {unassignedOrders.slice(0, 8).map((item) => (
                <div
                  key={`${item.type}-${item._id}`}
                  className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        item.type === 'work_order' 
                          ? 'bg-blue-50 text-blue-600' 
                          : 'bg-orange-50 text-orange-600'
                      }`}>
                        {item.type === 'work_order' ? 'OT' : 'VT'}
                      </span>
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                    </div>
                    <p className="text-xs text-gray-400 ml-8">
                      #{item.type === 'work_order' ? (item as UnassignedWorkOrder).workOrderNumber : (item as UnassignedVisit).visitNumber}
                      {item.clientSnapshot?.name && ` · ${item.clientSnapshot.name}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSelfAssign(item)}
                    className="px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 text-xs font-medium hover:bg-brand-100 transition-colors whitespace-nowrap"
                  >
                    Tomar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selfAssignWO && (
        selfAssignWO.type === 'work_order' ? (
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
        ) : (
          <SelfAssignmentVisitDrawer
            isOpen={selfAssignOpen}
            onClose={() => {
              setSelfAssignOpen(false);
              setSelfAssignWO(null);
            }}
            visitId={selfAssignWO.id}
            visitNumber={selfAssignWO.number}
            onAssigned={fetchData}
          />
        )
      )}
    </div>
  );
}