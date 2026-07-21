'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { MetricsCards } from '@/operations/components/centro-operativo/MetricsCards';
import { WorkOrderListView } from '@/operations/components/centro-operativo/WorkOrderListView';
import { CalendarView } from '@/operations/components/centro-operativo/CalendarView';
import { TechnicianWorkloadPanel } from '@/operations/components/centro-operativo/TechnicianWorkloadPanel';
import type {
  CentroOperativoDashboardResponse,
  CalendarEvent,
  WorkOrderRow,
} from '@/operations/types/centro-operativo';

type Tab = 'orders' | 'calendar' | 'technicians';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'orders', label: 'Órdenes', icon: '📋' },
  { id: 'calendar', label: 'Calendario', icon: '📅' },
  { id: 'technicians', label: 'Técnicos', icon: '👥' },
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

export default function CentroOperativoPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<CentroOperativoDashboardResponse | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboardData, calendarData, workOrdersData] = await Promise.allSettled([
        api.get<CentroOperativoDashboardResponse>('/api/operations/centro-operativo'),
        api.get<CalendarEvent[]>('/api/operations/centro-operativo/calendar'),
        api.get<{ data: any[]; total: number }>('/api/operations/work-orders'),
      ]);

      if (dashboardData.status === 'fulfilled') {
        setDashboard(dashboardData.value);
      }

      if (calendarData.status === 'fulfilled') {
        const raw = calendarData.value;
        setCalendarEvents(Array.isArray(raw) ? raw : []);
      }

      if (workOrdersData.status === 'fulfilled') {
        const raw = workOrdersData.value;
        const list = Array.isArray(raw) ? raw : raw?.data || [];
        setWorkOrders(list.map(mapWorkOrderToRow));
      }

      const failures = [dashboardData, calendarData, workOrdersData].filter(
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

  function handleEventClick(eventId: string) {
    router.push(`/work-orders/${eventId}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Centro Operativo</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? 'Cargando...' : `${workOrders.length} órdenes`}
            </p>
          </div>
          <button
            onClick={fetchAll}
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

      {/* Tabs — mobile-first: scrollable at top */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-0 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span>{tab.icon}</span>
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
          <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !dashboard ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Metrics — always visible */}
            {dashboard && (
              <MetricsCards
                summary={dashboard.summary}
                byPriority={dashboard.byPriority}
                technicianCount={dashboard.technicians?.length}
              />
            )}

            {/* Tab content */}
            {activeTab === 'orders' && (
              <WorkOrderListView
                workOrders={workOrders}
                onRefresh={fetchAll}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarView
                events={calendarEvents}
                technicians={dashboard?.technicians || []}
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
