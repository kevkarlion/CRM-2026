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
  scheduledStart?: string;
  scheduledEnd?: string;
  clientSnapshot?: { name?: string };
  locationSnapshot?: { address?: string; city?: string; name?: string };
  type: 'work_order';
}

interface UnassignedVisit {
  _id: string;
  visitNumber: string;
  title: string;
  status: string;
  priority: string;
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  clientSnapshot?: { name?: string };
  locationSnapshot?: { address?: string; city?: string; name?: string };
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
  const { isTechnician, isAdmin, loading: roleLoading, user } = useRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [unassignedOrders, setUnassignedOrders] = useState<UnassignedItem[]>([]);
  const [currentTechnicianId, setCurrentTechnicianId] = useState<string | null>(null);

  const [selfAssignOpen, setSelfAssignOpen] = useState(false);
  const [selfAssignWO, setSelfAssignWO] = useState<{ id: string; number: string; type: 'work_order' | 'technical_visit' } | null>(null);

  // Always define fetchData - don't conditionalize hooks
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
        const techId = (calendarResult.value as any).technicianId || null;
        console.log('[Calendar] Received events:', data.length, 'technicianId:', techId);
        setEvents(data);
        setCurrentTechnicianId(techId);
      } else {
        console.error('[Calendar] Error fetching calendar:', calendarResult.reason);
        setError(calendarResult.reason instanceof Error ? calendarResult.reason.message : 'Error al cargar calendario');
      }

      // Combine unassigned work orders and visits
      const unassigned: UnassignedItem[] = [];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Helper to check if date is in the future (not overdue)
      const isNotOverdue = (scheduledDate?: string) => {
        if (!scheduledDate) return true; // Sin fecha = no está vencida
        const date = new Date(scheduledDate);
        return date >= today;
      };

      if (workOrdersResult.status === 'fulfilled') {
        const rawWO = workOrdersResult.value;
        const listWO = Array.isArray(rawWO) ? rawWO : rawWO?.data || [];
        unassigned.push(
          ...listWO
            .filter((wo: UnassignedWorkOrder) => 
              wo.status === 'draft' &&
              isNotOverdue(wo.scheduledDate)
            )
            .map((wo: UnassignedWorkOrder) => ({ ...wo, type: 'work_order' as const }))
        );
      }

      if (visitsResult.status === 'fulfilled') {
        const rawTV = visitsResult.value;
        const listTV = Array.isArray(rawTV) ? rawTV : rawTV?.data || [];
        unassigned.push(
          ...listTV
            .filter((tv: UnassignedVisit) => 
              (tv.status === 'scheduled' || tv.status === 'confirmed') &&
              isNotOverdue(tv.scheduledDate)
            )
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

  const { todayCount, weekCount, todayJobs } = useMemo(() => {
    const now = new Date();
    const todayEvents = events.filter((e) => isSameDay(parseLocalDate(e.scheduledDate), now));
    const weekStart = getWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEvents = events.filter((e) => {
      const d = parseLocalDate(e.scheduledDate);
      return d >= weekStart && d < weekEnd;
    });

    // Sort today's events by time
    const todaySorted = todayEvents.sort((a, b) => {
      if (!a.scheduledStart) return 1;
      if (!b.scheduledStart) return -1;
      return new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime();
    });

    // Map all today's jobs
    const jobs = todaySorted.map((e) => ({
      type: e.type,
      title: e.title,
      time: e.scheduledStart
        ? new Date(e.scheduledStart).toLocaleTimeString('es-CL', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : parseLocalDate(e.scheduledDate).toLocaleDateString('es-CL', {
            day: '2-digit',
            month: '2-digit',
          }),
      client: e.clientSnapshot?.name || '',
      address: e.locationSnapshot?.address || '',
      technician: e.technician?.name || e.technicians?.[0]?.name || '',
    }));

    return {
      todayCount: todayEvents.length,
      weekCount: weekEvents.length,
      todayJobs: jobs,
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

  // Show loading skeleton while role is being determined (after all hooks are called)
  if (roleLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="bg-white border-b border-gray-200 px-4 py-4">
<div className="flex items-center justify-between" suppressHydrationWarning>
            <div>
              <h1 className="h-8 w-48 bg-gray-200 rounded animate-pulse text-transparent">Mis Órdenes</h1>
              <p className="h-5 w-64 bg-gray-100 rounded animate-pulse mt-2 text-transparent">0 órdenes y visitas técnicas</p>
            </div>
            <button
                  className="p-2 rounded-lg bg-gray-100 animate-pulse"
                  disabled
                >
                  <svg
                    className="w-5 h-5 animate-spin"
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
          <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 animate-pulse" />
                  <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="w-px h-6 bg-gray-200" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 animate-pulse" />
                  <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="h-[500px] bg-gray-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <div suppressHydrationWarning>
            <h1 className="text-xl font-bold text-gray-900" suppressHydrationWarning>{pageTitle}</h1>
            <p className="text-sm text-gray-500 mt-0.5" suppressHydrationWarning>
              {loading ? 'Cargando...' : description}
            </p>
          </div>
          <button
            suppressHydrationWarning
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

        <TechnicianAgendaSummary
          todayCount={todayCount}
          weekCount={weekCount}
          todayJobs={todayJobs}
          className={loading ? 'opacity-0 pointer-events-none' : ''}
        />

        <CalendarView 
          events={events} 
          onEventClick={handleEventClick} 
          currentTechnicianId={currentTechnicianId}
          className={loading ? 'opacity-0 pointer-events-none' : ''}
        />

        {/* Unassigned items for self-assignment - show only to technicians */}
        {isTechnician && unassignedOrders.length > 0 && (
          <div className="space-y-3">
<div className="flex items-center justify-between" suppressHydrationWarning>
              <h2 className="text-sm font-semibold text-gray-900">
                Disponibles para auto-asignar
              </h2>
              <span className="text-xs text-gray-400">{unassignedOrders.length} ítems</span>
            </div>

            <div className="space-y-2">
              {unassignedOrders.slice(0, 8).map((item) => {
                const isWO = item.type === 'work_order';
                const wo = item as UnassignedWorkOrder;
                const vt = item as UnassignedVisit;
                
                return (
                <div
                  key={`${item.type}-${item._id}`}
                  className="bg-white border border-gray-200 rounded-xl p-3 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          isWO 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {isWO ? 'OT' : 'VT'}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          item.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                          item.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {item.priority === 'urgent' ? 'Urgente' : 
                           item.priority === 'high' ? 'Alta' : 
                           item.priority === 'normal' ? 'Normal' : 'Baja'}
                        </span>
                      </div>
                      
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      
                      <div className="mt-1.5 space-y-0.5 text-xs text-gray-500">
                        <p className="flex items-center gap-1">
                          <span className="font-medium">#{isWO ? wo.workOrderNumber : vt.visitNumber}</span>
                          {item.clientSnapshot?.name && <span className="text-gray-400">• {item.clientSnapshot.name}</span>}
                        </p>
                        
                        {item.scheduledDate && (
                          <p className="flex items-center gap-1 text-brand-600">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {new Date(item.scheduledDate).toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' })}
                            {(isWO ? wo.scheduledStart : vt.scheduledStart) && (
                              <span className="text-gray-400">
                                {new Date(isWO ? wo.scheduledStart! : vt.scheduledStart!).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </p>
                        )}
                        
                        {(item as any).locationSnapshot?.address && (
                          <p className="flex items-center gap-1 truncate">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="truncate">{(item as any).locationSnapshot.address}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleSelfAssign(item)}
                      className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors whitespace-nowrap"
                    >
                      Tomar
                    </button>
                  </div>
                </div>
              );
              })}
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