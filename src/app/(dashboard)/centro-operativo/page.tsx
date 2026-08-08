'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { WorkOrderListView } from '@/operations/components/centro-operativo/WorkOrderListView';
import { CalendarView } from '@/operations/components/centro-operativo/CalendarView';
import { TechnicianWorkloadPanel } from '@/operations/components/centro-operativo/TechnicianWorkloadPanel';
import { TechnicalVisitsView } from '@/operations/components/centro-operativo/TechnicalVisitsView';
import { RefreshCw, ClipboardList, ClipboardCheck, Calendar, Users } from 'lucide-react';
import type {
  CentroOperativoDashboardResponse,
  CalendarEvent,
  WorkOrderRow,
  TechnicalVisitRow,
} from '@/operations/types/centro-operativo';

type Tab = 'orders' | 'visits' | 'calendar' | 'technicians';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'orders', label: 'Órdenes', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'visits', label: 'Visitas', icon: <ClipboardCheck className="w-4 h-4" /> },
  { id: 'calendar', label: 'Calendario', icon: <Calendar className="w-4 h-4" /> },
  { id: 'technicians', label: 'Técnicos', icon: <Users className="w-4 h-4" /> },
];

function mapWorkOrderToRow(wo: any): WorkOrderRow {
  return {
    _id: wo._id,
    workOrderNumber: wo.workOrderNumber,
    title: wo.title,
    description: wo.description,
    priority: wo.priority,
    category: wo.category,
    status: wo.status,
    source: wo.source,
    scheduledDate: wo.scheduledDate,
    scheduledStart: wo.scheduledStart,
    scheduledEnd: wo.scheduledEnd,
    clientSnapshot: wo.clientSnapshot,
    locationSnapshot: wo.locationSnapshot,
    assignedTechnicians: (wo.assignedTechnicians || []).map((t: any) =>
      typeof t === 'object' && t !== null ? (t.name || String(t._id)) : String(t),
    ),
    technicianNames: (wo.assignedTechnicians || [])
      .filter((t: any) => typeof t === 'object' && t !== null)
      .map((t: any) => t.name),
    version: wo.version,
  };
}

function mapVisitToRow(v: any): TechnicalVisitRow {
  const tech = v.assignedTechnicianId;
  return {
    _id: v._id,
    visitNumber: v.visitNumber,
    title: v.title,
    status: v.status,
    priority: v.priority,
    category: v.category,
    scheduledDate: v.scheduledDate,
    scheduledStart: v.scheduledStart,
    clientSnapshot: v.clientSnapshot,
    locationSnapshot: v.locationSnapshot,
    technicianName: tech && typeof tech === 'object' ? tech.name : null,
  };
}

export default function CentroOperativoPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<CentroOperativoDashboardResponse | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [currentTechnicianId, setCurrentTechnicianId] = useState<string | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([]);
  const [technicalVisits, setTechnicalVisits] = useState<TechnicalVisitRow[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range for calendar (current month + next 2 months)
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);

      const [dashboardData, calendarData, workOrdersData, visitsData] = await Promise.allSettled([
        api.get<CentroOperativoDashboardResponse>('/api/operations/centro-operativo'),
        // Use work-orders/all-calendar with date params like work-orders/calendar
        api.get<CalendarEvent[]>('/api/operations/work-orders/all-calendar', {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
        api.get<{ data: any[]; total: number }>('/api/operations/work-orders'),
        api.get<{ data: any[]; total: number }>('/api/operations/technical-visits'),
      ]);

      if (dashboardData.status === 'fulfilled') {
        setDashboard(dashboardData.value);
      }

      if (calendarData.status === 'fulfilled') {
        const raw = calendarData.value;
        // API returns { data: [...], total: n, technicianId } format
        const events = Array.isArray(raw) ? raw : raw?.data || [];
        setCalendarEvents(events);
        // Pass current user's technician ID so the CalendarView can show the "MÍA" badge
        // on events assigned to the current technician (same behavior as /work-orders/calendar)
        const techId = !Array.isArray(raw) ? (raw as any)?.technicianId || null : null;
        setCurrentTechnicianId(techId);
      }

      if (workOrdersData.status === 'fulfilled') {
        const raw = workOrdersData.value;
        const list = Array.isArray(raw) ? raw : raw?.data || [];
        setWorkOrders(list.map(mapWorkOrderToRow));
      }

      if (visitsData.status === 'fulfilled') {
        const raw = visitsData.value;
        const list = Array.isArray(raw) ? raw : raw?.data || [];
        setTechnicalVisits(list.map(mapVisitToRow));
      }

      const failures = [dashboardData, calendarData, workOrdersData, visitsData].filter(
        (r) => r.status === 'rejected',
      );
      if (failures.length > 0) {
        const msg = (failures[0] as PromiseRejectedResult).reason;
        setError(msg instanceof Error ? msg.message : 'Error al cargar datos');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function handleEventClick(event: CalendarEvent) {
    if (event.type === 'technical_visit') {
      router.push(`/technical-visits/${event._id}`);
    } else {
      router.push(`/work-orders/${event._id}`);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">CENTRO OPERATIVO TÉCNICO</h1>
            <div className="text-sm text-gray-500 dark:text-slate-400 mt-0.5 space-y-0.5">
              {loading ? 'Cargando...' : (
                <>
                  <div>
                    <span className="text-brand-600 dark:text-brand-400 font-medium">Órdenes de trabajo: {workOrders.filter(w => ['scheduled', 'confirmed', 'assigned', 'in_progress'].includes(w.status)).length}</span>
                  </div>
                  <div>
                    <span className="text-purple-600 dark:text-purple-400 font-medium">Visitas técnicas: {technicalVisits.filter(v => ['scheduled', 'confirmed', 'assigned', 'in_progress'].includes(v.status)).length}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            title="Actualizar"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs — mobile-first: scrollable at top */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="flex overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-0 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-600 dark:border-brand-400 bg-brand-50 dark:bg-brand-900/20'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Error */}
        {error && (
          <div className="rounded-lg bg-danger-50 dark:bg-danger-900/20 px-4 py-3 text-sm text-danger-700 dark:text-danger-300">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !dashboard ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-24 bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Tab content */}
            {activeTab === 'orders' && (
              <WorkOrderListView
                workOrders={workOrders}
                onRefresh={fetchAll}
              />
            )}

            {activeTab === 'visits' && (
              <TechnicalVisitsView
                visits={technicalVisits}
                onRefresh={fetchAll}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarView
                events={calendarEvents}
                technicians={dashboard?.technicians || []}
                currentTechnicianId={currentTechnicianId}
                onEventClick={handleEventClick}
              />
            )}

            {activeTab === 'technicians' && (
              <TechnicianWorkloadPanel
                technicians={dashboard?.technicians || []}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
